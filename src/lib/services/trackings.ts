import {
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    where,
    orderBy,
    arrayUnion,
    arrayRemove,
    limit
} from "firebase/firestore";
import { getTenantDoc, getTenantCollection } from "../firebase/firestore";
import { Tracking, TrackingTask, TrackingMaterial, DailyLog, Pago } from "../types";
import { safeUpdateDoc, removeUndefined } from "../utils/firestore-helpers";



export const TrackingsService = {
    getById: async (tenantId: string, id: string): Promise<Tracking | null> => {
        const docRef = getTenantDoc("trackings", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        const data = snap.data();
        return {
            id: snap.id,
            ...data,
            tasks: Array.isArray(data.tasks) ? data.tasks : [],
            materials: Array.isArray(data.materials) ? data.materials : [],
            dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs : [],
            pagos: Array.isArray(data.pagos) ? data.pagos : [],
            extras: Array.isArray(data.extras) ? data.extras : [],
            purchases: Array.isArray(data.purchases) ? data.purchases : [],
            paymentPromises: Array.isArray(data.paymentPromises) ? data.paymentPromises : [],
            checklist: Array.isArray(data.checklist) ? data.checklist : []
        } as Tracking;
    },

    getByClient: async (tenantId: string, clientId: string): Promise<Tracking[]> => {
        const colRef = getTenantCollection("trackings");
        const q = query(
            colRef,
            where("clientId", "==", clientId),
            orderBy("createdAt", "desc")
        );
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    tasks: Array.isArray(data.tasks) ? data.tasks : [],
                    materials: Array.isArray(data.materials) ? data.materials : [],
                    dailyLogs: Array.isArray(data.dailyLogs) ? data.dailyLogs : [],
                    pagos: Array.isArray(data.pagos) ? data.pagos : [],
                    extras: Array.isArray(data.extras) ? data.extras : [],
                    purchases: Array.isArray(data.purchases) ? data.purchases : [],
                    paymentPromises: Array.isArray(data.paymentPromises) ? data.paymentPromises : [],
                    checklist: Array.isArray(data.checklist) ? data.checklist : []
                } as Tracking;
            })
            .filter(t => !t.deletedAt);
    },

    update: async (tenantId: string, id: string, data: Partial<Tracking>) => {
        const docRef = getTenantDoc("trackings", id);
        await safeUpdateDoc(docRef, { ...data, updatedAt: Date.now() });
    },

    updateStatus: async (tenantId: string, id: string, status: Tracking['status']) => {
        const docRef = getTenantDoc("trackings", id);
        const updates: any = { status, updatedAt: Date.now() };

        // Updates dates based on status transition
        if (status === 'in_progress') updates['dates.startedAt'] = Date.now();
        if (status === 'delivered') updates['dates.deliveredAt'] = Date.now();
        if (status === 'closed') updates['dates.closedAt'] = Date.now();
        if (status === 'canceled') updates['dates.canceledAt'] = Date.now();

        await safeUpdateDoc(docRef, updates);
    },

    updateChecklist: async (tenantId: string, id: string, checklist: any[]) => {
        const docRef = getTenantDoc("trackings", id);
        await safeUpdateDoc(docRef, { checklist, updatedAt: Date.now() });
    },

    delete: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("trackings", id);
        await safeUpdateDoc(docRef, {
            deletedAt: Date.now(),
            updatedAt: Date.now()
        });
    },

    restore: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("trackings", id);
        await safeUpdateDoc(docRef, {
            deletedAt: null,
            updatedAt: Date.now()
        });
    },

    listDeleted: async (tenantId: string) => {
        const colRef = getTenantCollection("trackings");
        const q = query(colRef, where("deletedAt", ">", 0), orderBy("deletedAt", "desc"), limit(50));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Tracking));
    },

    deletePermanent: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("trackings", id);
        await deleteDoc(docRef);
    },

    getDeletedIds: async (tenantId: string) => {
        const colRef = getTenantCollection("trackings");
        const q = query(colRef, where("deletedAt", ">", 0), limit(100));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.id);
    },

    // --- Tasks ---
    addTask: async (tenantId: string, trackingId: string, task: TrackingTask) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            tasks: arrayUnion(removeUndefined(task)),
            updatedAt: Date.now()
        });
    },

    updateTasks: async (tenantId: string, trackingId: string, tasks: TrackingTask[]) => {
        // Replace entire array for updates like reordering or editing
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            tasks: tasks.map(removeUndefined),
            updatedAt: Date.now()
        });
    },

    // --- Materials ---
    addMaterial: async (tenantId: string, trackingId: string, material: TrackingMaterial) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            materials: arrayUnion(removeUndefined(material)),
            updatedAt: Date.now()
        });
    },

    updateMaterials: async (tenantId: string, trackingId: string, materials: TrackingMaterial[]) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            materials: materials.map(removeUndefined),
            updatedAt: Date.now()
        });
    },

    // --- Daily Logs ---
    addLog: async (tenantId: string, trackingId: string, log: DailyLog) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            dailyLogs: arrayUnion(removeUndefined(log)),
            updatedAt: Date.now()
        });
    },

    // --- Extras ---
    addExtra: async (tenantId: string, trackingId: string, extra: any, newTotal: number, newSaldo: number) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            extras: arrayUnion(extra),
            total: newTotal,
            saldoPendiente: newSaldo,
            updatedAt: Date.now()
        });
    },

    updateExtras: async (tenantId: string, trackingId: string, extras: any[], newTotal: number, newSaldo: number) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            extras,
            total: newTotal,
            saldoPendiente: newSaldo,
            updatedAt: Date.now()
        });
    },

    removeExtra: async (tenantId: string, trackingId: string, extra: any, newTotal: number, newSaldo: number) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            extras: arrayRemove(extra),
            total: newTotal,
            saldoPendiente: newSaldo,
            updatedAt: Date.now()
        });
    },

    // --- Purchases ---
    addPurchase: async (tenantId: string, trackingId: string, purchase: any) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            purchases: arrayUnion(purchase),
            updatedAt: Date.now()
        });
    },

    removePurchase: async (tenantId: string, trackingId: string, purchase: any) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            purchases: arrayRemove(purchase),
            updatedAt: Date.now()
        });
    },

    // --- Promises ---
    addPromise: async (tenantId: string, trackingId: string, promise: any) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            paymentPromises: arrayUnion(promise),
            updatedAt: Date.now()
        });
    },

    updatePromises: async (tenantId: string, trackingId: string, promises: any[]) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            paymentPromises: promises,
            updatedAt: Date.now()
        });
    },

    // --- Payments ---
    registerPayment: async (tenantId: string, trackingId: string, payment: Pago, saldoPendiente: number) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            pagos: arrayUnion(removeUndefined(payment)),
            saldoPendiente,
            updatedAt: Date.now()
        });
    },

    deletePayment: async (tenantId: string, trackingId: string, payment: Pago, saldoPendiente: number) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            pagos: arrayRemove(payment),
            saldoPendiente,
            updatedAt: Date.now()
        });
    },

    hasTrackings: async (tenantId: string, clientId: string): Promise<boolean> => {
        const colRef = getTenantCollection("trackings");
        const q = query(colRef, where("clientId", "==", clientId), limit(1));
        const snap = await getDocs(q);
        return !snap.empty;
    },

    updateItemSchedule: async (tenantId: string, trackingId: string, itemSchedule: any) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, { itemSchedule, updatedAt: Date.now() });
    }
};
