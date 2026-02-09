import {
    getDocs,
    query,
    orderBy,
    limit,
    serverTimestamp,
    doc,
    getDoc,
    where,
    updateDoc
} from "firebase/firestore";
import { getTenantCollection, getTenantDoc, TENANT_ID } from "../firebase/firestore";
import { QuoteFormValues } from "../validation/schemas";
import { safeAddDoc, safeUpdateDoc } from "../utils/firestore-helpers";
// Re-export type if needed or strictly use schemas
// But we might need 'id' which is not in FormValues. 

export const QuotesService = {

    createQuote: async (values: QuoteFormValues) => {
        const colRef = getTenantCollection("quotes");

        // CALCULATE TOTALS
        // Items total
        const itemsTotal = values.items.reduce((acc, item) => acc + (item.total || 0), 0);

        // Materials total (default to empty array if missing)
        const materialsTotal = (values.materials || []).reduce((acc, mat) => acc + (mat.total || 0), 0);

        const subtotal = itemsTotal + materialsTotal;
        const total = subtotal - (values.descuentoGlobal || 0);

        // Calculate validity days
        let validezDias = 15;
        if (values.date && values.validUntil) {
            validezDias = Math.ceil((new Date(values.validUntil).getTime() - new Date(values.date).getTime()) / (1000 * 60 * 60 * 24));
        }

        // CONSTRUCT DOCUMENT
        const docData = {
            ...values,
            // Explicitly saving snapshot fields if schema allows spreading them from values.
            // If values has them (clarifications, etc), they are saved.

            // Map 'status' to 'estado'
            estado: values.status,

            // Snapshot for list display
            clienteSnapshot: {
                nombre: values.client.name,
                direccion: values.client.lines.join(", "),
                email: values.client.email || "",
                telefono: values.client.phone || "",
            },

            subtotal,
            descuentoGlobal: values.descuentoGlobal || 0,
            total: total > 0 ? total : 0,
            saldoPendiente: total > 0 ? total : 0,
            validezDias,
            numero: `P-${Date.now().toString().slice(-6)}`, // Temporary numbering

            ownerId: TENANT_ID,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        const docRef = await safeAddDoc(colRef, docData);

        return { id: docRef.id };
    },

    updateQuote: async (id: string, values: Partial<QuoteFormValues>) => {
        const docRef = getTenantDoc("quotes", id);

        const updates: any = {
            ...values,
            updatedAt: serverTimestamp()
        };

        // Recalculate validezDias if dates are present
        if (values.date && values.validUntil) {
            updates.validezDias = Math.ceil((new Date(values.validUntil).getTime() - new Date(values.date).getTime()) / (1000 * 60 * 60 * 24));
        }

        await safeUpdateDoc(docRef, updates);
    },

    delete: async (id: string) => {
        const docRef = getTenantDoc("quotes", id);
        // Soft delete
        await safeUpdateDoc(docRef, {
            deletedAt: Date.now(),
            updatedAt: Date.now()
        });
    },

    restore: async (id: string) => {
        const docRef = getTenantDoc("quotes", id);
        await safeUpdateDoc(docRef, {
            deletedAt: null,
            updatedAt: Date.now()
        });
    },

    listDeleted: async () => {
        const colRef = getTenantCollection("quotes");
        const q = query(colRef, where("deletedAt", ">", 0), orderBy("deletedAt", "desc"), limit(50));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // Listing methods retained/updated 
    listByStatus: async (status?: string) => {
        const colRef = getTenantCollection("quotes");
        let q = query(colRef, orderBy("createdAt", "desc"), limit(100));
        if (status) {
            q = query(colRef, where("status", "==", status), orderBy("createdAt", "desc"), limit(100));
        }
        const snap = await getDocs(q);
        return snap.docs
            .map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    // Normalized fields for list view
                    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (typeof data.createdAt === 'number' ? data.createdAt : Date.now()),
                    updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()),
                    clienteSnapshot: {
                        nombre: data.clienteSnapshot?.nombre || data.client?.name || "Cliente",
                        // Other fields might not be needed for list but good for consistency
                        direccion: data.clienteSnapshot?.direccion || "",
                        email: data.clienteSnapshot?.email || "",
                        telefono: data.clienteSnapshot?.telefono || ""
                    },
                    estado: data.estado || data.status || 'draft',
                    total: data.total || 0,
                    titulo: data.titulo || data.title || "Sin Título"
                }
            })
            .filter((d: any) => !d.deletedAt); // Client-side filter for soft delete
    },

    // Helper to get raw data for edit form
    getById: async (id: string) => {
        const docRef = getTenantDoc("quotes", id);
        const snap = await getDoc(docRef);
        if (!snap.exists()) return null;

        const data = snap.data();

        // Return as Presupuesto type (timestamps as numbers)
        // Assume data spread includes other matching fields
        return {
            id: snap.id,
            ...data,
            // Consistency: Check if Timestamp or number/string
            createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (typeof data.createdAt === 'number' ? data.createdAt : Date.now()),
            updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : (typeof data.updatedAt === 'number' ? data.updatedAt : Date.now()),

            // Normalize Arrays to avoid undefined map errors
            items: data.items || [],
            materials: data.materials || [],
            notQuotedItems: data.notQuotedItems || [],

            // Normalize Client Snapshot
            clienteSnapshot: {
                nombre: data.clienteSnapshot?.nombre || data.client?.name || "Cliente Desconocido",
                direccion: data.clienteSnapshot?.direccion || (data.client?.lines ? data.client.lines.join(", ") : "") || "",
                email: data.clienteSnapshot?.email || data.client?.email || "",
                telefono: data.clienteSnapshot?.telefono || data.client?.phone || ""
            },

            // Normalize status
            estado: data.estado || data.status || 'draft',

            // Normalize other fields
            validezDias: data.validezDias || 15,
            subtotal: data.subtotal || 0,
            total: data.total || 0,
            descuentoGlobal: data.descuentoGlobal || 0
        } as any; // Cast to any effectively or import Presupuesto to cast properly. 
        // Ideally: return result as Presupuesto
    }
};
