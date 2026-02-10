import {
    deleteDoc,
    getDocs,
    getDoc,
    query,
    orderBy,
    limit,
    updateDoc,
    where
} from "firebase/firestore";
import { getTenantCollection, getTenantDoc } from "../firebase/firestore";
import type { Cliente } from "../types";
import { makeClientId } from "../logic/client-helpers";
import { safeSetDoc, safeUpdateDoc } from "../utils/firestore-helpers";

export const ClientsService = {
    create: async (tenantId: string, data: Omit<Cliente, "id" | "createdAt" | "updatedAt" | "ownerId">) => {
        const colRef = getTenantCollection("clientes");
        const clientRef = getTenantDoc("clientes", makeClientId({ email: data.email, telefono: data.telefono }));

        // Upsert logic (merge if exists)
        await safeSetDoc(clientRef, {
            ...data,
            id: clientRef.id,
            ownerId: tenantId,
            createdAt: Date.now(), // Only valid for new
            updatedAt: Date.now(),
        }, { merge: true });
    },

    upsert: async (tenantId: string, data: Partial<Cliente>) => {
        // Logic to find valid ID
        if (!data.email && !data.telefono && !data.id) throw new Error("Need email, phone or ID to upsert");

        const id = data.id || makeClientId({ email: data.email, telefono: data.telefono });
        const clientRef = getTenantDoc("clientes", id);

        await safeSetDoc(clientRef, {
            ...data,
            id: id,
            ownerId: tenantId,
            updatedAt: Date.now()
        }, { merge: true });

        return id;
    },

    update: async (tenantId: string, id: string, data: Partial<Cliente>) => {
        const docRef = getTenantDoc("clientes", id);
        await safeUpdateDoc(docRef, {
            ...data,
            updatedAt: Date.now()
        });
    },

    list: async (tenantId: string) => {
        const colRef = getTenantCollection("clientes");

        const q = query(colRef, orderBy("nombre"), limit(100)); // Limit for safety
        const snapshot = await getDocs(q);
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Cliente))
            .filter(c => !c.deletedAt);
    },

    // Fuzzy search client
    search: async (tenantId: string, search: string) => {
        const colRef = getTenantCollection("clientes");
        // Firestore doesn't accept multiple inequality filters or complex text search easily. 
        // We'll fetch frequent first + some limit, then client-side filter for this snippet if list is small.
        // Or just fetch all (if < 500) and filter. 
        // Better: Fetch top 50 recent/frequent.

        const q = query(colRef, orderBy("updatedAt", "desc"), limit(50));
        const snapshot = await getDocs(q);
        const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));

        if (!search) return all;

        const lower = search.toLowerCase();
        return all.filter(c =>
            c.nombre.toLowerCase().includes(lower) ||
            c.email?.toLowerCase().includes(lower) ||
            c.telefono?.includes(search)
        ).filter((c: Cliente) => !c.deletedAt);
    },

    getById: async (tenantId: string, id: string): Promise<Cliente | null> => {
        const docRef = getTenantDoc("clientes", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;
        return { id: snap.id, ...snap.data() } as Cliente;
    },

    delete: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("clientes", id);
        await safeUpdateDoc(docRef, {
            deletedAt: Date.now(),
            updatedAt: Date.now()
        });
    },

    restore: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("clientes", id);
        await safeUpdateDoc(docRef, {
            deletedAt: null,
            updatedAt: Date.now()
        });
    },

    listDeleted: async (tenantId: string) => {
        const colRef = getTenantCollection("clientes");
        const q = query(colRef, where("deletedAt", ">", 0), orderBy("deletedAt", "desc"), limit(50));
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente));
    },

    deletePermanent: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("clientes", id);
        await deleteDoc(docRef);
    },

    getDeletedIds: async (tenantId: string) => {
        const colRef = getTenantCollection("clientes");
        const q = query(colRef, where("deletedAt", ">", 0), limit(100));
        const snap = await getDocs(q);
        return snap.docs.map(d => d.id);
    }
};
