import { z } from "zod";

// --- CLIENT SCHEMA ---
export const ClientSchema = z.object({
    name: z.string().min(1, "El nombre del cliente es requerido"),
    lines: z.array(z.string().min(1, "La línea de dirección no puede estar vacía"))
        .min(1, "Debe ingresar al menos una línea de dirección"),
    phone: z.string().optional(),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
});

// --- ITEMS SCHEMA ---
// Helper to validate that at least one of two fields is present
const numberOrText = (numField: string, textField: string) =>
    z.object({ [numField]: z.number().optional(), [textField]: z.string().optional() })
        .refine((data: any) => data[numField] !== undefined || (data[textField] && data[textField].length > 0), {
            message: "Debe ingresar valor numérico o texto",
            path: [numField] // Mark error on the number field by default
        });

// We need a base object and then superRefine or consistent refinement
// To keep it simple with Zod resolvers in RHF, we define fields and a superRefine/refine.

export const QuoteItemSchema = z.object({
    itemNo: z.number().optional(), // Auto-calculated usually
    task: z.string().min(1, "La tarea/ítem es requerida"),

    unitPrice: z.number().transform(v => Math.round(v)).optional(),
    unitPriceText: z.string().optional(),

    quantity: z.number().transform(v => Math.round(v)).optional(),
    quantityText: z.string().optional(),

    total: z.number().transform(v => Math.round(v)).optional(),
    totalText: z.string().optional()
}).refine(data => data.unitPrice !== undefined || !!data.unitPriceText, {
    message: "Requerido", path: ["unitPrice"]
}).refine(data => data.quantity !== undefined || !!data.quantityText, {
    message: "Requerido", path: ["quantity"]
}).refine(data => data.total !== undefined || !!data.totalText, {
    message: "Requerido", path: ["total"]
});


// --- FORM SCHEMA ---
export const QuoteFormSchema = z.object({
    title: z.string().min(1, "El título es requerido"),
    // Changed to string for HTML date input compatibility
    date: z.string().min(1, "Fecha requerida"),
    validUntil: z.string().min(1, "Fecha válida requerida"),

    status: z.enum(["draft", "pending", "approved"]),

    client: ClientSchema,

    items: z.array(QuoteItemSchema).min(1, "Debe agregar al menos un ítem"),

    // Materials (Optional)
    materials: z.array(z.object({
        name: z.string().min(1, "Nombre requerido"),
        quantity: z.number().min(0, "Debe ser positivo").transform(v => Math.round(v)),
        unit: z.string().optional(), // Added unit
        unitPrice: z.number().min(0, "Debe ser positivo").transform(v => Math.round(v)),
        total: z.number().transform(v => Math.round(v)).optional() // Changed from subtotal to total for consistency
    })).optional().default([]),

    // Finanzas
    descuentoGlobal: z.number().transform(v => Math.round(v)).optional().default(0),

    // Textos / Snapshots
    notQuotedItems: z.array(z.string()).optional(),
    clarifications: z.string().optional(),
    conditions: z.string().optional(), // New
    notes: z.string().optional(), // New (Customer notes)
    paymentConditions: z.string().optional(),
    paymentMethod: z.string().optional(),

    // Internal Notes (Part B)
    internalNotesText: z.string().optional(),
    internalNotesTemplateId: z.string().optional(),
}).refine((data) => {
    if (!data.date || !data.validUntil) return true;
    return new Date(data.validUntil) >= new Date(data.date);
}, {
    message: "La fecha de validez debe ser posterior o igual a la fecha del presupuesto",
    path: ["validUntil"]
});

export type ClientValues = z.infer<typeof ClientSchema>;
export type QuoteItemValues = z.infer<typeof QuoteItemSchema>;
export type QuoteFormValues = z.infer<typeof QuoteFormSchema>;

// --- PROVIDER SCHEMA ---
export const ProviderProfileSchema = z.object({
    fullName: z.string().min(3, "Mínimo 3 caracteres"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    address: z.string().optional(),
    signature: z.object({
        format: z.literal("svg"),
        svg: z.string(),
        updatedAt: z.any() // Timestamp from Firestore
    }).optional().nullable()
});

export type ProviderProfileValues = z.infer<typeof ProviderProfileSchema>;

// --- TEMPLATES SCHEMA ---
export const TemplateSchema = z.object({
    id: z.string().optional(),
    type: z.enum(["clarifications", "conditions", "notes", "paymentConditions", "paymentMethod", "internalNotes"]),
    title: z.string().min(1, "El título es requerido"),
    content: z.string().min(1, "El contenido es requerido"),
    active: z.boolean(),
    isDefault: z.boolean(),
});

export type TemplateValues = z.infer<typeof TemplateSchema>;
