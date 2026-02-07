import {
    addDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch,
    limit
} from "firebase/firestore";
import { db, getTenantCollection, getTenantDoc, TENANT_ID } from "../firebase/firestore";
import { TemplateValues } from "../validation/schemas";

export const TemplatesService = {
    create: async (data: TemplateValues) => {
        const colRef = getTenantCollection("templates");
        await addDoc(colRef, {
            ...data,
            ownerId: TENANT_ID,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    },

    update: async (id: string, data: Partial<TemplateValues>) => {
        const docRef = getTenantDoc("templates", id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        });
    },

    delete: async (id: string) => {
        const docRef = getTenantDoc("templates", id);
        await deleteDoc(docRef);
    },

    listAll: async () => {
        const colRef = getTenantCollection("templates");
        // Sort by isDefault desc, then updatedAt
        const q = query(colRef, orderBy("isDefault", "desc"), orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateValues));
    },

    listByType: async (type: string, opts?: { activeOnly?: boolean }) => {
        const colRef = getTenantCollection("templates");
        let constraints: any[] = [where("type", "==", type)];

        if (opts?.activeOnly) {
            constraints.push(where("active", "==", true));
        }

        // Note: orderBy requires index if combining equality and inequality filters usually,
        // but here active==true is equality.
        // isDefault is mainly for sorting.
        const q = query(colRef, ...constraints, orderBy("isDefault", "desc"), orderBy("updatedAt", "desc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateValues));
    },

    getDefaultTemplate: async (type: string) => {
        const colRef = getTenantCollection("templates");
        // Only active and default
        const q = query(colRef,
            where("type", "==", type),
            where("active", "==", true),
            where("isDefault", "==", true),
            limit(1)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as TemplateValues;
    },

    setDefaultTemplate: async (id: string, type: string) => {
        // Enforce single default per type using Batch
        // 1. Get all templates of this type that are currently default
        const colRef = getTenantCollection("templates");
        const q = query(colRef, where("type", "==", type), where("isDefault", "==", true));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db);

        // 2. Set isDefault=false for all EXISTING defaults
        snapshot.docs.forEach(docSnap => {
            if (docSnap.id !== id) {
                batch.update(docSnap.ref, { isDefault: false, updatedAt: serverTimestamp() });
            }
        });

        // 3. Set isDefault=true for the target ID
        const targetRef = getTenantDoc("templates", id);
        batch.update(targetRef, { isDefault: true, updatedAt: serverTimestamp() });

        await batch.commit();
    },

    toggleActive: async (id: string, active: boolean) => {
        const docRef = getTenantDoc("templates", id);
        // If deactivating, verify if it was default. Ideally we unset default too.
        const updates: any = { active, updatedAt: serverTimestamp() };
        if (!active) {
            updates.isDefault = false;
        }
        await updateDoc(docRef, updates);
    }
};
