import {
    addDoc,
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy
} from "firebase/firestore";
import { getTenantCollection, getTenantDoc } from "../firebase/firestore";
import { ExtraTemplate } from "../types";
import { safeUpdateDoc } from "../utils/firestore-helpers";

export const ExtraTemplatesService = {
    list: async (tenantId: string): Promise<ExtraTemplate[]> => {
        const colRef = getTenantCollection("extra_templates");
        const q = query(colRef, orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtraTemplate));
    },

    add: async (tenantId: string, template: Omit<ExtraTemplate, 'id' | 'createdAt' | 'updatedAt' | 'ownerId'>) => {
        const colRef = getTenantCollection("extra_templates");
        await addDoc(colRef, {
            ...template,
            ownerId: tenantId,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    },

    update: async (tenantId: string, id: string, data: Partial<ExtraTemplate>) => {
        const docRef = getTenantDoc("extra_templates", id);
        await safeUpdateDoc(docRef, { ...data, updatedAt: Date.now() });
    },

    delete: async (tenantId: string, id: string) => {
        const docRef = getTenantDoc("extra_templates", id);
        await deleteDoc(docRef);
    },

    seedDefaults: async (tenantId: string) => {
        const defaults = [
            { name: "Punto de luz adicional", description: "Boca de iluminación extra", unit: "u", price: 15000 },
            { name: "Tomacorriente doble extra", description: "Módulo doble", unit: "u", price: 18000 },
            { name: "Cableado por metro", description: "Recableado de circuito", unit: "ml", price: 3500 },
            { name: "Visita técnica extra", description: "Visita no programada", unit: "u", price: 25000 },
            { name: "Cambio de térmica", description: "Provisión y mano de obra", unit: "u", price: 45000 }
        ];

        const colRef = getTenantCollection("extra_templates");
        for (const t of defaults) {
            await addDoc(colRef, {
                ...t,
                ownerId: tenantId,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }
    }
};
