import {
    query,
    getDocs,
    orderBy,
    limit,
    where
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
    // Ya no recibe tenantId, usa el global
    getStats: async (): Promise<DashboardStats> => {
        const colRef = getTenantCollection("presupuestos");
        // Limitamos para evitar lecturas masivas en Spark plan
        const q = query(colRef, limit(100));
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
            } else if (['approved', 'in_progress', 'completed'].includes(p.estado)) {
                stats.totalAprobados++;
                stats.montoTotalAprobado += (p.total || 0);

                if (p.pagos) {
                    stats.montoCobrado += p.pagos.reduce((acc: number, pay: any) => acc + pay.monto, 0);
                }
            }
        });

        return stats;
    },

    getRecentEvents: async () => {
        const colRef = getTenantCollection("presupuestos");
        const q = query(colRef, orderBy("createdAt", "desc"), limit(50));
        const snap = await getDocs(q);

        return snap.docs.map(doc => {
            const p = doc.data() as Presupuesto;
            return {
                id: doc.id,
                title: `Presupuesto #${p.numero || 'S/N'} - ${p.clienteSnapshot?.nombre || 'Cliente'}`,
                start: p.createdAt ? new Date(p.createdAt) : new Date(),
                end: p.createdAt ? new Date(p.createdAt + (p.validezDias || 15) * 24 * 60 * 60 * 1000) : new Date(),
                resource: p
            };
        });
    }
};
