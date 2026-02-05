import {
    doc,
    runTransaction,
    Timestamp,
    collection,
    serverTimestamp,
    increment
} from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import type {
    Presupuesto,
    Material,
    ChecklistItem,
    Pago,
    MovimientoStock
} from "@/lib/types";

// --- Helpers ---
const generateChecklistFromItems = (items: Presupuesto['items']): ChecklistItem[] => {
    return items.map((item, index) => ({
        id: `chk_${Date.now()}_${index}`,
        texto: `${item.descripcion} (${item.cantidad} ${item.unidad})`,
        completado: false
    }));
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
    userId: string,
    presupuestoId: string
): Promise<void> => {
    const userRef = doc(db, "users", userId);
    const presupuestoRef = doc(userRef, "presupuestos", presupuestoId);

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

            const materialRefs = materialItems.map(i =>
                doc(userRef, "materiales", i.materialReferenceId!)
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
                // Aquí podríamos validar: if (material.stockActual - material.stockComprometido < item.cantidad) ...

                // Update: Incrementar 'stockComprometido'
                // Nota: En Client SDK 'increment' es una operación atómica de campo, 
                // pero dentro de una transacción usamos data set/update directo para consistencia de lectura.
                const newComprometido = (material['stockComprometido'] || 0) + item.cantidad; // Asumiendo campo extendido

                transaction.update(mDoc.ref, {
                    // @ts-ignore: Asumiendo que extendimos la interfaz Material en la implementación
                    stockComprometido: newComprometido
                });

                // Generar Movimiento de Stock (Log)
                const movimientoRef = doc(collection(userRef, "movimientos"));
                const movimiento: MovimientoStock = {
                    id: movimientoRef.id,
                    ownerId: userId,
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    materialId: material.id,
                    tipo: 'salida', // O 'reserva', depende de la lógica contable. 'salida' física es al entregar.
                    cantidad: item.cantidad,
                    referencia: `Reserva Presupuesto #${presupuesto.numero}`,
                    fecha: Date.now()
                };
                transaction.set(movimientoRef, movimiento);
            }

            // 4. Generar Checklist
            const checklist = generateChecklistFromItems(presupuesto.items);

            // 5. Actualizar Presupuesto
            transaction.update(presupuestoRef, {
                estado: 'approved',
                checklist: checklist,
                saldoPendiente: presupuesto.total, // Inicializa deuda
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
 * 1. Agrega pago al array (o colección).
 * 2. Recalcula saldo pendiente.
 * 3. Verifica si se completó el total para cambiar estado a 'completed' (opcional).
 */
export const registerPayment = async (
    userId: string,
    presupuestoId: string,
    pagoInput: Omit<Pago, 'id'>
): Promise<void> => {
    const userRef = doc(db, "users", userId);
    const presupuestoRef = doc(userRef, "presupuestos", presupuestoId);

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
            let nuevoSaldo = presupuesto.total - totalPagado;

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
