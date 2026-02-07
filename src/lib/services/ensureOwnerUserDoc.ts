import { getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { User } from "firebase/auth";
import { getTenantDoc } from "../firebase/firestore";

/**
 * Verifica y crea el documento de usuario (Bootstrap)
 * Ruta: tenants/julian-marti/users/{uid}
 */
export const ensureOwnerUserDoc = async (user: User) => {
    if (!user) return;

    try {
        const userDocRef = getTenantDoc("users", user.uid);
        const userSnapshot = await getDoc(userDocRef);

        if (!userSnapshot.exists()) {
            console.log("Bootstrap: Creando documento de usuario owner...");
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email,
                role: "owner",     // Rol por defecto
                active: true,      // Activo por defecto
                createdAt: serverTimestamp(),
            });
            console.log("Bootstrap: Éxito.");
        }
    } catch (error) {
        console.error("Error en bootstrap ensureOwnerUserDoc:", error);
        // No lanzamos error para no bloquear la app visualmente, pero se loguea.
    }
};
