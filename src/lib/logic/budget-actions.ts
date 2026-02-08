import {
    runTransaction,
    Timestamp,
    serverTimestamp,
    increment,
    doc,
    getDocs,
    query,
    where,
    collection
} from "firebase/firestore";
import { db, getTenantCollection, getTenantDoc, TENANT_ID } from "@/lib/firebase/firestore";
import type {
    Presupuesto,
    Material,
    ChecklistItem,
    Pago,
    MovimientoStock,
    Cliente,
    Tracking,
    ClienteSnapshot,
    TrackingTask,
    TrackingMaterial
} from "@/lib/types";

// --- Helpers ---
const generateTrackingTasks = (items: any[]): TrackingTask[] => {
    if (!Array.isArray(items)) return [];

    return items.map((item, index) => {
        const desc = item.descripcion || item.task || "Ítem sin descripción";
        const qty = item.cantidad ?? item.quantity;
        const unit = item.unidad || item.unit;

        let text = desc;
        const details = [];
        if (qty !== undefined && qty !== null && qty !== "") details.push(qty);
        if (unit) details.push(unit);

        if (details.length > 0) {
            text += ` (${details.join(" ")})`;
        }

        return {
            id: `task_${Date.now()}_${index}`,
            text: text,
            completed: false,
            originalItemId: item.id
        };
    });
};

const generateTrackingMaterials = (materials: any[]): TrackingMaterial[] => {
    if (!Array.isArray(materials)) return [];

    return materials.map((mat, index) => ({
        id: `mat_${Date.now()}_${index}`,
        name: mat.name || mat.nombre || "Material sin nombre",
        quantity: mat.quantity ?? mat.cantidad ?? 0,
        unit: mat.unit || mat.unidad || "u",
        status: 'planned',
        originalMaterialId: mat.id
    }));
};

/**
 * Helper to remove undefined keys from an object (Firestore doesn't support undefined)
 */
const stripUndefined = (obj: any): any => {
    return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined) {
            acc[key] = value;
        }
        return acc;
    }, {} as any);
};

/**
 * Aprobación de Presupuesto
 * 1. Verifica stock (opcional: lanza error si falta).
 * 2. Reserva stock (comprometido += cantidad).
 * 3. Actualiza estado presupuesto a 'approved'.
 * 4. Genera Checklist de seguimiento.
 * 5. Upsert Cliente (Clients Collection).
 * 6. Genera Tracking (Trackings Collection).
 * 7. Links everything via IDs.
 * 8. Registra Movimientos de Stock (log).
 */
export const approveBudget = async (
    tenantId: string, // Kept for interface compatibility
    presupuestoId: string
): Promise<void> => {
    const presupuestoRef = getTenantDoc("quotes", presupuestoId);

    try {
        // --- Step 0: Pre-fetch outside transaction to find Client ---
        // We need budget data to search for client
        // Note: In a high-concurrency env, this snapshot could be stale, but we re-read inside tx.
        // For Client search, we accept slight race condition on creation.

        // 1. Get snapshot for logic
        // We can't use getDoc here easily without importing it, but we can reuse the ref inside transaction for the "official" read.
        // However, to search for the client, we need the data NOW.
        // Let's rely on the transaction to do everything if we use deterministic IDs for Clients.
        // Strategy: Deterministic Client ID based on Normalized Email or Phone.
        // client_${normalized_email} OR client_${normalized_phone} OR client_${hash(name)}
        // This avoids query inside transaction.

        await runTransaction(db, async (transaction) => {
            // 1. Leer Presupuesto
            const pDoc = await transaction.get(presupuestoRef);
            if (!pDoc.exists()) throw new Error("Presupuesto no encontrado");

            const presupuesto = pDoc.data() as Presupuesto;
            if (presupuesto.estado === 'approved') throw new Error("Ya está aprobado");

            // --- Client Logic (Upsert) ---
            const clientSnap = presupuesto.clienteSnapshot;
            let clientKey = "";
            if (clientSnap.email) clientKey = clientSnap.email.toLowerCase().trim();
            else if (clientSnap.telefono) clientKey = clientSnap.telefono.replace(/\D/g, '');
            else clientKey = clientSnap.nombre.toLowerCase().trim().replace(/\s+/g, '_');

            // Ensure valid ID characters
            const safeClientKey = clientKey.replace(/[^a-zA-Z0-9_]/g, '');
            const clientId = `client_${safeClientKey}`;
            const clientRef = getTenantDoc("clientes", clientId); // FIXED: clients -> clientes

            console.log("quoteRef.path:", presupuestoRef.path);
            console.log("clientRef.path:", clientRef.path);

            const cDoc = await transaction.get(clientRef);

            // New Client Data
            const now = Date.now();
            const clientData: Partial<Cliente> = {
                nombre: clientSnap.nombre,
                email: clientSnap.email,
                telefono: clientSnap.telefono,
                direccion: clientSnap.direccion,
                cuit: clientSnap.cuit,
                updatedAt: now,
                lastQuoteId: presupuesto.id,
                lastQuoteNumber: presupuesto.numero,
                ownerId: tenantId
            };

            // Sanitize clientData
            const sanitizedClientData = stripUndefined(clientData);

            if (!cDoc.exists()) {
                // Create
                transaction.set(clientRef, {
                    ...sanitizedClientData,
                    id: clientId,
                    createdAt: now
                });
            } else {
                // Update
                transaction.update(clientRef, sanitizedClientData);
            }

            // --- Tracking Logic (Create) ---
            const trackingRef = doc(getTenantCollection("trackings"));
            console.log("trackingRef.path:", trackingRef.path);
            const tasks = generateTrackingTasks(presupuesto.items);
            const materials = generateTrackingMaterials((presupuesto as any).materials);

            const tracking: Tracking = {
                id: trackingRef.id,
                ownerId: tenantId,
                createdAt: now,
                updatedAt: now,

                quoteId: presupuesto.id,
                quoteNumber: presupuesto.numero || "??",
                title: presupuesto.titulo || (presupuesto as any).title || "Trabajo",

                clientId: clientId,
                clientSnapshot: clientSnap,

                tasks: tasks,
                materials: materials,
                dailyLogs: [],

                pagos: [],
                saldoPendiente: presupuesto.total || 0,
                total: presupuesto.total || 0,

                status: 'pending_start', // or 'in_progress'
                presupuestoRef: presupuesto.id
            };

            // Sanitize tracking data
            const sanitizedTracking = stripUndefined(tracking);

            transaction.set(trackingRef, sanitizedTracking);

            // Update Client with Active Tracking if none
            // We set it to this new tracking. If user had another one, this overwrites as "current".
            transaction.update(clientRef, {
                activeTrackingId: tracking.id
            });

            // --- Stock Logic (Existing) ---
            // 2. Preparar lecturas de materiales
            const materialItems = presupuesto.items.filter(
                i => i.tipo === 'material' && i.materialReferenceId
            );

            const materialRefs = materialItems.map(i =>
                getTenantDoc("materiales", i.materialReferenceId!)
            );

            // Leer todos los materiales en paralelo (dentro de la tx)
            const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));

            // 3. Validar y preparar actualizaciones de stock
            for (let i = 0; i < materialDocs.length; i++) {
                const mDoc = materialDocs[i];
                const item = materialItems[i];

                if (!mDoc.exists()) throw new Error(`Material ID ${item.materialReferenceId} no encontrado`);

                const material = mDoc.data() as Material;
                const newComprometido = ((material as any)['stockComprometido'] || 0) + item.cantidad;

                transaction.update(mDoc.ref, {
                    // @ts-ignore
                    stockComprometido: newComprometido
                });

                // Generar Movimiento de Stock (Log)
                // Also tenant level: tenants/{id}/movimientos
                const movimientoRef = doc(getTenantCollection("movimientos"));
                const movimiento: MovimientoStock = {
                    id: movimientoRef.id,
                    ownerId: tenantId,
                    createdAt: now,
                    updatedAt: now,
                    materialId: material.id,
                    tipo: 'salida',
                    cantidad: item.cantidad,
                    referencia: `Reserva Presupuesto #${presupuesto.numero || presupuestoId}`,
                    fecha: now
                };
                transaction.set(movimientoRef, stripUndefined(movimiento));
            }

            // --- Update Quote (Final) ---
            const quoteUpdates = {
                estado: 'approved',
                approvedAt: now,
                updatedAt: now,
                trackingId: tracking.id,

                saldoPendiente: presupuesto.total || 0
            };

            transaction.update(presupuestoRef, stripUndefined(quoteUpdates));
        });

        console.log("Presupuesto aprobado, Cliente y Tracking actualizados.");

    } catch (error) {
        console.error("Error aprobando presupuesto:", error);
        throw error;
    }
};

/**
 * Registro de Pago Parcial
 */
export const registerPayment = async (
    tenantId: string,
    presupuestoId: string,
    pagoInput: Omit<Pago, 'id'>
): Promise<void> => {
    // Use correct tenant path
    const presupuestoRef = getTenantDoc("quotes", presupuestoId);

    try {
        await runTransaction(db, async (transaction) => {
            const pDoc = await transaction.get(presupuestoRef);
            if (!pDoc.exists()) throw new Error("Presupuesto no encontrado");

            const presupuesto = pDoc.data() as Presupuesto;
            const nuevoPago: Pago = {
                ...pagoInput,
                id: `pay_${Date.now()}`
            };

            const pagosActuales = presupuesto.pagos || [];
            const nuevosPagos = [...pagosActuales, nuevoPago];

            // Calcular nuevo saldo
            const totalPagado = nuevosPagos.reduce((acc, p) => acc + p.monto, 0);
            let nuevoSaldo = (presupuesto.total || 0) - totalPagado;

            // Floating point correction simple
            nuevoSaldo = Math.round(nuevoSaldo * 100) / 100;

            // Actualizar
            const updates: any = {
                pagos: nuevosPagos,
                saldoPendiente: nuevoSaldo,
                updatedAt: Date.now()
            };

            // Auto-completar si saldo es 0 (y ya estaba en progress/approved)
            if (nuevoSaldo <= 0 && presupuesto.estado !== 'completed') {
                updates.estado = 'completed';
            } else if (nuevoSaldo > 0 && presupuesto.estado === 'approved') {
                updates.estado = 'in_progress'; // Primer pago activa "en progreso"
            }

            transaction.update(presupuestoRef, updates);
        });

    } catch (error) {
        console.error("Error registrando pago:", error);
        throw error;
    }
};
