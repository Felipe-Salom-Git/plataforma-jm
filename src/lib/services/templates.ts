import {
    addDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    writeBatch
} from "firebase/firestore";
import { getTenantCollection, getTenantDoc, db } from "../firebase/firestore"; // Ensure db is exported from here or client
import { TemplateValues } from "../validation/schemas";
import { safeUpdateDoc } from "../utils/firestore-helpers";

// We'll use a single collection "templates"
const COLLECTION_NAME = "templates";

export const TemplatesService = {
    listAll: async (): Promise<TemplateValues[]> => {
        const colRef = getTenantCollection(COLLECTION_NAME);
        const q = query(colRef, orderBy("title", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TemplateValues));
    },

    create: async (data: TemplateValues) => {
        const colRef = getTenantCollection(COLLECTION_NAME);
        await addDoc(colRef, {
            ...data,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    },

    update: async (id: string, data: Partial<TemplateValues>) => {
        const docRef = getTenantDoc(COLLECTION_NAME, id);
        await safeUpdateDoc(docRef, { ...data, updatedAt: Date.now() });
    },

    delete: async (id: string) => {
        const docRef = getTenantDoc(COLLECTION_NAME, id);
        await deleteDoc(docRef);
    },

    toggleActive: async (id: string, active: boolean) => {
        const docRef = getTenantDoc(COLLECTION_NAME, id);
        await safeUpdateDoc(docRef, { active, updatedAt: Date.now() });
    },

    setDefaultTemplate: async (id: string, type: string) => {
        // 1. Unset default for all others of same type
        const colRef = getTenantCollection(COLLECTION_NAME);
        const q = query(colRef, where("type", "==", type), where("isDefault", "==", true));
        const snapshot = await getDocs(q);

        const batch = writeBatch(db); // Use exported db instance
        snapshot.docs.forEach(doc => {
            if (doc.id !== id) {
                batch.update(doc.ref, { isDefault: false });
            }
        });

        // 2. Set this one as default
        const docRef = getTenantDoc(COLLECTION_NAME, id);
        batch.update(docRef, { isDefault: true, updatedAt: Date.now() });

        await batch.commit();
    },

    // Helper to get default content
    getDefaultContent: async (type: string): Promise<string> => {
        const colRef = getTenantCollection(COLLECTION_NAME);
        const q = query(colRef, where("type", "==", type), where("isDefault", "==", true), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            return (snapshot.docs[0].data() as TemplateValues).content;
        }
        return "";
    }
};

import { limit } from "firebase/firestore";
