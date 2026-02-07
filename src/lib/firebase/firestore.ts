import {
    getFirestore,
    collection,
    doc,
    DocumentData,
    CollectionReference,
    DocumentReference,
} from "firebase/firestore";
import { app } from "./client";

export const db = getFirestore(app);

// Tenant fijo constante
export const TENANT_ID = "julian-marti";

/**
 * Helper para obtener CollectionReference bajo el tenant fijo.
 * Path: tenants/julian-marti/{collectionName}
 */
export const getTenantCollection = (
    collectionName: string
): CollectionReference<DocumentData> => {
    return collection(db, "tenants", TENANT_ID, collectionName);
};

/**
 * Helper para obtener DocumentReference bajo el tenant fijo.
 * Path: tenants/julian-marti/{collectionName}/{docId}
 */
export const getTenantDoc = (
    collectionName: string,
    docId: string
): DocumentReference<DocumentData> => {
    return doc(db, "tenants", TENANT_ID, collectionName, docId);
};
