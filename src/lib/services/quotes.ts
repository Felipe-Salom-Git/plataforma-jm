import {
    addDoc,
    updateDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    doc,
    getDoc
} from "firebase/firestore";
import { getTenantCollection, getTenantDoc } from "../firebase/firestore";
import type { Presupuesto } from "../types";

export const QuotesService = {

    create: async (tenantId: string, data: Omit<Presupuesto, "id" | "createdAt" | "updatedAt" | "ownerId">) => {
        const colRef = getTenantCollection(tenantId, "presupuestos");

        // Auto-generate doc ref to get ID first if needed, or let addDoc do it.
        // We add timestamp and ownerId automatically.
        const newDoc = await addDoc(colRef, {
            ...data,
            ownerId: tenantId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });

        return newDoc.id;
    },

    update: async (tenantId: string, id: string, data: Partial<Presupuesto>) => {
        const docRef = getTenantDoc(tenantId, "presupuestos", id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Date.now()
        });
    },

    getById: async (tenantId: string, id: string): Promise<Presupuesto | null> => {
        const docRef = getTenantDoc(tenantId, "presupuestos", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Presupuesto;
    },

    listByStatus: async (tenantId: string, status?: string) => {
        const colRef = getTenantCollection(tenantId, "presupuestos");
        let q = query(colRef, orderBy("createdAt", "desc"), limit(50));

        if (status) {
            q = query(colRef, where("estado", "==", status), orderBy("createdAt", "desc"), limit(50));
        }

        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Presupuesto));
    },

    // Specialized query for dashboard
    listRecent: async (tenantId: string) => {
        const colRef = getTenantCollection(tenantId, "presupuestos");
        const q = query(colRef, orderBy("updatedAt", "desc"), limit(5));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Presupuesto));
    }
};
