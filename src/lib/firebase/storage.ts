import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "firebase/storage";
import { app } from "./client";

export const storage = getStorage(app);

/**
 * Uploads a Blob/File to Storage under the tenant's path.
 * Path format: users/{tenantId}/{folder}/{fileName}
 */
export const uploadFile = async (
    tenantId: string,
    file: Blob | File,
    folder: string,
    fileName: string
): Promise<string> => {
    const fullPath = `users/${tenantId}/${folder}/${fileName}`;
    const storageRef = ref(storage, fullPath);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
};

export const deleteFile = async (url: string): Promise<void> => {
    const storageRef = ref(storage, url);
    await deleteObject(storageRef);
};
