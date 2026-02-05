import {
    getFirestore,
    collection,
    doc,
    DocumentData,
    CollectionReference,
    DocumentReference
} from "firebase/firestore";
import { app } from "./client";

export const db = getFirestore(app);

// --- Multi-tenant Helpers ---

// Helper to get a collection reference scoped to a tenant (user)
export const getTenantCollection = (
    tenantId: string,
    collectionName: string
): CollectionReference<DocumentData> => {
    // Strategy: Subcollections per User -> /users/{tenantId}/{collectionName}
    return collection(db, "users", tenantId, collectionName);
};

// Helper to get a config/settings doc reference
export const getTenantDoc = (
    tenantId: string,
    collectionName: string,
    docId: string
): DocumentReference<DocumentData> => {
    return doc(db, "users", tenantId, collectionName, docId);
};
