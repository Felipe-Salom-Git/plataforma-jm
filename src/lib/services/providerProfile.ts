import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    updateDoc
} from "firebase/firestore";
import { getTenantDoc, TENANT_ID } from "../firebase/firestore";
import { ProviderProfileValues } from "../validation/schemas";

const CONFIG_DOC_PATH = "config/provider";

export const ProviderProfileService = {
    getProfile: async (): Promise<ProviderProfileValues | null> => {
        // Construct path manually to ensure it hits 'config/provider' subcollection/doc pattern 
        // OR if it's a root collection, use getTenantCollection. 
        // User requested: tenants/julian-marti/config/provider
        // This implies 'config' is a collection and 'provider' is a doc.

        // We can use getTenantDoc if we treat "config" as the collection.
        const docRef = getTenantDoc("config", "provider");
        const snap = await getDoc(docRef);

        if (snap.exists()) {
            return snap.data() as ProviderProfileValues;
        }
        return null;
    },

    saveProfile: async (data: Partial<ProviderProfileValues>) => {
        const docRef = getTenantDoc("config", "provider");
        // We use setDoc with merge: true to effectively upsert
        await setDoc(docRef, {
            ...data,
            updatedAt: serverTimestamp()
        }, { merge: true });
    },

    saveSignature: async (svg: string) => {
        const docRef = getTenantDoc("config", "provider");
        await setDoc(docRef, {
            signature: {
                format: "svg",
                svg: svg,
                updatedAt: serverTimestamp()
            },
            updatedAt: serverTimestamp()
        }, { merge: true });
    },

    removeSignature: async () => {
        const docRef = getTenantDoc("config", "provider");
        await updateDoc(docRef, {
            signature: null,
            updatedAt: serverTimestamp()
        });
    }
};
