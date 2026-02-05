import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    Timestamp
} from "firebase/firestore";
import { getTenantCollection } from "../firebase/firestore";
import { Presupuesto } from "../types";

export interface DashboardStats {
    totalPresupuestos: number;
    totalPendientes: number;
    totalAprobados: number;
    montoTotalPendiente: number;
    montoTotalAprobado: number;
    montoCobrado: number;
}

export const DashboardService = {
    getStats: async (tenantId: string): Promise<DashboardStats> => {
        const colRef = getTenantCollection(tenantId, "presupuestos");

        // Simplification: Fetch all active budgets to calc stats client-side or stick to simple queries.
        // Ideally, use a sharded counter or aggregation query (count()), but for starters read valid docs.
        const q = query(colRef, limit(100)); // Limit for safety
        const snap = await getDocs(q);

        const stats: DashboardStats = {
            totalPresupuestos: 0,
            totalPendientes: 0,
            totalAprobados: 0,
            montoTotalPendiente: 0,
            montoTotalAprobado: 0,
            montoCobrado: 0
        };

        snap.forEach(doc => {
            const p = doc.data() as Presupuesto;
            stats.totalPresupuestos++;

            if (p.estado === 'pending') {
                stats.totalPendientes++;
                stats.montoTotalPendiente += (p.total || 0);
            } else if (p.estado === 'approved' || p.estado === 'in_progress' || p.estado === 'completed') {
                stats.totalAprobados++;
                stats.montoTotalAprobado += (p.total || 0);

                // Sumar pagos si existen
                if (p.pagos) {
                    stats.montoCobrado += p.pagos.reduce((acc, pay) => acc + pay.monto, 0);
                }
            }
        });

        return stats;
    },

    getRecentEvents: async (tenantId: string) => {
        // Return budgets that have validUntil close? Or specific events collection?
        // For now, let's map budgets to calendar events based on creation or validUntil.
        const colRef = getTenantCollection(tenantId, "presupuestos");
        const q = query(colRef, orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);

        return snap.docs.map(doc => {
            const p = doc.data() as Presupuesto;
            return {
                id: doc.id,
                title: `Presupuesto #${p.numero || 'S/N'} - ${p.clienteSnapshot.nombre}`,
                start: new Date(p.createdAt),
                end: new Date(p.createdAt + (p.validezDias * 24 * 60 * 60 * 1000)), // Crude approximation
                resource: p
            };
        });
    }
};
