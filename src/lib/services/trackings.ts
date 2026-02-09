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
            tasks: data.tasks || [],
            materials: data.materials || [],
            dailyLogs: data.dailyLogs || [],
            pagos: data.pagos || []
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
                    tasks: data.tasks || [],
                    materials: data.materials || [],
                    dailyLogs: data.dailyLogs || [],
                    pagos: data.pagos || []
                } as Tracking;
            })
            .filter(t => !t.deletedAt);
    },

    update: async (tenantId: string, id: string, data: Partial<Tracking>) => {
        const docRef = getTenantDoc("trackings", id);
        await safeUpdateDoc(docRef, { ...data, updatedAt: Date.now() });
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

    // --- Payments ---
    registerPayment: async (tenantId: string, trackingId: string, payment: Pago, newTotalPaid: number, total: number) => {
        const docRef = getTenantDoc("trackings", trackingId);
        await safeUpdateDoc(docRef, {
            pagos: arrayUnion(removeUndefined(payment)),
            saldoPendiente: total - newTotalPaid,
            updatedAt: Date.now()
        });
    }
};
