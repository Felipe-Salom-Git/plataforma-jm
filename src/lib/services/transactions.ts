import {
    addDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    limit
} from "firebase/firestore";
import { getTenantCollection } from "../firebase/firestore";
import { TransaccionManual } from "../types";

export const TransactionsService = {

    create: async (data: Omit<TransaccionManual, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>): Promise<TransaccionManual> => {
        const colRef = getTenantCollection("manual_transactions");
        const now = Date.now();

        const newDoc: any = {
            ...data,
            createdAt: now,
            updatedAt: now,
        };

        const ref = await addDoc(colRef, newDoc);
        return { id: ref.id, ...newDoc } as TransaccionManual;
    },

    listRecent: async (limitCount = 50): Promise<TransaccionManual[]> => {
        const colRef = getTenantCollection("manual_transactions");
        const q = query(colRef, orderBy("fecha", "desc"), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as TransaccionManual));
    },

    listByMonth: async (year: number, month: number): Promise<TransaccionManual[]> => {
        const colRef = getTenantCollection("manual_transactions");
        const start = new Date(year, month, 1).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();

        const q = query(colRef, where("fecha", ">=", start), where("fecha", "<=", end));
        const snap = await getDocs(q);
        return snap.docs
            .map(d => ({ id: d.id, ...d.data() } as TransaccionManual))
            .sort((a, b) => b.fecha - a.fecha);
    },

    delete: async (id: string) => {
        const colRef = getTenantCollection("manual_transactions");
        await deleteDoc(doc(colRef, id));
    }
};
