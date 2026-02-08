import {
    addDoc,
    setDoc,
    updateDoc,
    DocumentReference,
    CollectionReference,
    Transaction,
    DocumentData,
    WithFieldValue,
    UpdateData
} from "firebase/firestore";

/**
 * Recursively removes keys with `undefined` values from an object or array.
 * Firestore does not support `undefined` values.
 *
 * @param obj The object or array to sanitize.
 * @returns A new object or array with `undefined` values removed.
 */
export function removeUndefined(obj: any): any {
    if (Array.isArray(obj)) {
        return obj
            .filter(v => v !== undefined)
            .map(v => removeUndefined(v));
    } else if (obj !== null && typeof obj === 'object') {
        // Handle specialized objects like Date or Firestore Timestamp if needed
        // But those are generally fine. 
        // We only primarily care about plain objects.
        // A simple check is constructor === Object, but that might fail for custom classes unless intended.
        // For now, let's keep it simple recursive plain object check.

        const newObj: any = {};
        Object.keys(obj).forEach((key) => {
            const value = obj[key];
            if (value !== undefined) {
                newObj[key] = removeUndefined(value);
            }
        });
        return newObj;
    }
    return obj;
}

/**
 * Logs paths to `undefined` values in an object.
 * Useful for debugging "Transaction.set() called with invalid data" errors.
 */
export function logUndefinedPaths(obj: any, contextLabel: string): void {
    if (process.env.NODE_ENV !== 'development') return;

    const paths: string[] = [];

    const findPaths = (current: any, prefix: string) => {
        if (Array.isArray(current)) {
            current.forEach((v, i) => findPaths(v, `${prefix}[${i}]`));
        } else if (current !== null && typeof current === 'object') {
            Object.keys(current).forEach((key) => {
                const value = current[key];
                if (value === undefined) {
                    paths.push(`${prefix}.${key}`);
                } else {
                    findPaths(value, `${prefix}.${key}`);
                }
            });
        }
    };

    findPaths(obj, "root");

    if (paths.length > 0) {
        console.error(`[Firestore Undefined Detector] Context: ${contextLabel}`);
        console.error(`Found ${paths.length} undefined fields:`, paths);
    }
}

// --- SAFE WRAPPERS ---

export const safeAddDoc = async <T = DocumentData>(
    collectionRef: CollectionReference<T>,
    data: WithFieldValue<T>
) => {
    logUndefinedPaths(data, `safeAddDoc -> ${collectionRef.path}`);
    return addDoc(collectionRef, removeUndefined(data));
};

export const safeSetDoc = async <T = DocumentData>(
    docRef: DocumentReference<T>,
    data: WithFieldValue<T>,
    options?: any
) => {
    logUndefinedPaths(data, `safeSetDoc -> ${docRef.path}`);
    if (options) {
        return setDoc(docRef, removeUndefined(data), options);
    }
    return setDoc(docRef, removeUndefined(data));
};

export const safeUpdateDoc = async <T = DocumentData>(
    docRef: DocumentReference<T>,
    data: UpdateData<T>
) => {
    logUndefinedPaths(data, `safeUpdateDoc -> ${docRef.path}`);
    return updateDoc(docRef, removeUndefined(data));
};

export const safeTxSet = <T = DocumentData>(
    transaction: Transaction,
    docRef: DocumentReference<T>,
    data: WithFieldValue<T>,
    options?: any
) => {
    logUndefinedPaths(data, `safeTxSet -> ${docRef.path}`);
    if (options) {
        return transaction.set(docRef, removeUndefined(data), options);
    }
    return transaction.set(docRef, removeUndefined(data));
};

export const safeTxUpdate = <T = DocumentData>(
    transaction: Transaction,
    docRef: DocumentReference<T>,
    data: UpdateData<T>
) => {
    logUndefinedPaths(data, `safeTxUpdate -> ${docRef.path}`);
    return transaction.update(docRef, removeUndefined(data));
};
