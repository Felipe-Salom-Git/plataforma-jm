import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "firebase/firestore";
import { getTenantCollection } from "../firebase/firestore";
import { Gasto } from "../types";

export const ExpensesService = {

    create: async (data: Omit<Gasto, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>): Promise<Gasto> => {
        const colRef = getTenantCollection("gastos");
        const now = Date.now();

        // We need auth context to get ownerId usually, but `getTenantCollection` handles the path. 
        // We still need to save ownerId in the doc for safety if we query collectionGroup later.
        // For now, assuming standard tenant collection logic.

        const newDoc: any = {
            ...data,
            createdAt: now,
            updatedAt: now,
            // ownerId is implied by collection path in this architecture usually, 
            // but let's see how other services do it. 
            // ClientHelpers doesn't set it explicitly in addDoc? 
            // `getTenantCollection` returns `users/{userId}/...` so it is secured.
        };

        const ref = await addDoc(colRef, newDoc);
        return { id: ref.id, ...newDoc } as Gasto;
    },

    listRecent: async (limitCount = 50): Promise<Gasto[]> => {
        const colRef = getTenantCollection("gastos");
        const q = query(colRef, orderBy("fecha", "desc"), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Gasto));
    },

    listByMonth: async (year: number, month: number): Promise<Gasto[]> => {
        const colRef = getTenantCollection("gastos");
        const start = new Date(year, month, 1).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();

        const q = query(colRef, where("fecha", ">=", start), where("fecha", "<=", end));
        const snap = await getDocs(q);
        // Sorting in memory if compound index missing
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Gasto))
            .sort((a, b) => b.fecha - a.fecha);
    },

    delete: async (id: string) => {
        const colRef = getTenantCollection("gastos");
        await deleteDoc(doc(colRef, id));
    }
};
