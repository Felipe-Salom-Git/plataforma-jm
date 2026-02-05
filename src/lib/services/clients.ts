import {
    addDoc,
    updateDoc,
    getDocs,
    query,
    orderBy,
    limit
} from "firebase/firestore";
import { getTenantCollection, getTenantDoc } from "../firebase/firestore";
import type { Cliente } from "../types";

export const ClientsService = {
    create: async (tenantId: string, data: Omit<Cliente, "id" | "createdAt" | "updatedAt" | "ownerId">) => {
        const colRef = getTenantCollection(tenantId, "clientes");
        await addDoc(colRef, {
            ...data,
            ownerId: tenantId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        });
    },

    update: async (tenantId: string, id: string, data: Partial<Cliente>) => {
        const docRef = getTenantDoc(tenantId, "clientes", id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Date.now()
        });
    },

    list: async (tenantId: string) => {
        const colRef = getTenantCollection(tenantId, "clientes");
        const q = query(colRef, orderBy("nombre"), limit(100)); // Limit for safety
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
    }
};
