import {
    runTransaction,
    Timestamp,
    serverTimestamp,
    increment,
    doc
} from "firebase/firestore";
import { db, getTenantCollection, getTenantDoc, TENANT_ID } from "@/lib/firebase/firestore";
import type {
    Presupuesto,
    Material,
    ChecklistItem,
    Pago,
    MovimientoStock
} from "@/lib/types";

// --- Helpers ---
const generateChecklistFromItems = (items: any[], materials: any[] = []): ChecklistItem[] => {
    const checklist: ChecklistItem[] = [];

    // Helper to format text
    const formatItemText = (mainText: string, qty?: number | string, unit?: string) => {
        let text = mainText;
        const details = [];
        if (qty !== undefined && qty !== null && qty !== "") details.push(qty);
        if (unit) details.push(unit);

        if (details.length > 0) {
            text += ` (${details.join(" ")})`;
        }
        return text;
    };

    // Process Main Items
    if (Array.isArray(items)) {
        items.forEach((item, index) => {
            // Fallback for legacy fields: task vs descripcion, unit vs unidad
            const desc = item.descripcion || item.task || "Ítem sin descripción";
            const qty = item.cantidad ?? item.quantity;
            const unit = item.unidad || item.unit;

            checklist.push({
                id: `chk_item_${Date.now()}_${index}`,
                texto: formatItemText(desc, qty, unit),
                completado: false
            });
        });
    }

    // Process Materials
    if (materials && Array.isArray(materials)) {
        materials.forEach((mat, index) => {
            const name = mat.name || mat.nombre || "Material sin nombre";
            const qty = mat.quantity ?? mat.cantidad;
            const unit = mat.unit || mat.unidad;

            checklist.push({
                id: `chk_mat_${Date.now()}_${index}`,
                texto: formatItemText(`Material: ${name}`, qty, unit),
                completado: false
            });
        });
    }

    return checklist;
};

/**
 * Aprobación de Presupuesto
 * 1. Verifica stock (opcional: lanza error si falta).
 * 2. Reserva stock (comprometido += cantidad).
 * 3. Actualiza estado presupuesto a 'approved'.
 * 4. Genera Checklist de seguimiento.
 * 5. Registra Movimientos de Stock (log).
 */
export const approveBudget = async (
    tenantId: string, // Kept for interface compatibility, though we use fixed TENANT_ID internally or could use this param if passed correctly
    presupuestoId: string
): Promise<void> => {
    // We use the helper to ensure we point to the correct tenant collection
    // Collection Name MUST match list/create service: "quotes"
    const presupuestoRef = getTenantDoc("quotes", presupuestoId);

    try {
        await runTransaction(db, async (transaction) => {
            // 1. Leer Presupuesto
            const pDoc = await transaction.get(presupuestoRef);
            if (!pDoc.exists()) throw new Error("Presupuesto no encontrado");

            const presupuesto = pDoc.data() as Presupuesto;
            if (presupuesto.estado === 'approved') throw new Error("Ya está aprobado");

            // 2. Preparar lecturas de materiales (solo los que son 'material' y tienen ID)
            const materialItems = presupuesto.items.filter(
                i => i.tipo === 'material' && i.materialReferenceId
            );

            // Materiales are also at tenant level: tenants/{id}/materiales
            const materialRefs = materialItems.map(i =>
                getTenantDoc("materiales", i.materialReferenceId!)
            );

            // Leer todos los materiales en paralelo (dentro de la tx)
            const materialDocs = await Promise.all(materialRefs.map(ref => transaction.get(ref)));

            // 3. Validar y preparar actualizaciones de stock
            for (let i = 0; i < materialDocs.length; i++) {
                const mDoc = materialDocs[i];
                const item = materialItems[i];

                if (!mDoc.exists()) {
                    // Opcional: ignorar o fallar. Aquí fallamos por seguridad.
                    throw new Error(`Material ID ${item.materialReferenceId} no encontrado`);
                }

                const material = mDoc.data() as Material;

                // Update: Incrementar 'stockComprometido'
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
                    ownerId: tenantId, // Or authorized user ID if available, but for now tenantId
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    materialId: material.id,
                    tipo: 'salida',
                    cantidad: item.cantidad,
                    referencia: `Reserva Presupuesto #${presupuesto.numero || presupuestoId}`,
                    fecha: Date.now()
                };
                transaction.set(movimientoRef, movimiento);
            }

            // 4. Generar Checklist
            const checklist = generateChecklistFromItems(presupuesto.items, (presupuesto as any).materials);

            // 5. Actualizar Presupuesto
            transaction.update(presupuestoRef, {
                estado: 'approved',
                checklist: checklist,
                saldoPendiente: presupuesto.total || 0, // Inicializa deuda
                updatedAt: Date.now()
            });
        });

        console.log("Presupuesto aprobado con éxito");

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
