import { useAuth } from "@/context/AuthContext";

/**
 * Hook to resolve the current Tenant ID.
 * 
 * Strategy: "User is Tenant" (Simple SaaS / Firebase Free Tier optimized).
 * The Tenant ID matches the User ID exactly.
 * 
 * Future-proof note: If we move to Team/Organization model, 
 * this hook can be updated to fetch `user.tenantId` from a Firestore profile.
 */
export const useTenant = () => {
    const { user } = useAuth();

    // En nuestro diseño actual, el Tenant ID es el User ID.
    // Retorna undefined si no está logueado.
    const tenantId = user?.uid;

    if (user && !tenantId) {
        console.warn("User logged in but no Tenant ID resolved (UID missing?!)");
    }

    return {
        tenantId,
        isAuthenticated: !!user,
        user
    };
};
