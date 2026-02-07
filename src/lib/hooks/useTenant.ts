import { useAuth } from "@/context/AuthContext";
import { TENANT_ID } from "@/lib/firebase/firestore";

/**
 * Devuelve siempre el TENANT_ID fijo de la plataforma.
 * No depende de user.uid ni de la URL.
 */
export const useTenant = () => {
    const { user } = useAuth();

    return {
        tenantId: TENANT_ID,
        isAuthenticated: !!user,
        user,
    };
};
