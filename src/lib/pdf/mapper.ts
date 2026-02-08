import { Presupuesto } from '@/lib/types';
import { QuotePdfData } from '@/lib/pdf/generateQuotePdf';

// Utility to clean numbers
export const safeNum = (val: any): number => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
};

// --- Helpers ---
export const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
    if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
        const d = new Date(value);
        // Basic check if valid
        return isNaN(d.getTime()) ? null : d;
    }
    return null;
};

export const formatDate = (value: any): string => {
    const d = toDate(value);
    if (!d || isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
};

// Utility to convert SVG string to PNG Data URI
export async function convertSvgToPng(svgString: string): Promise<string> {
    return new Promise((resolve, reject) => {
        // Enforce dimensions if missing to avoid 0x0
        if (!svgString.includes('width=') && !svgString.includes('height=')) {
            svgString = svgString.replace('<svg ', '<svg width="400" height="150" ');
        }

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.width || 400; // Fallback
            canvas.height = img.height || 150; // Fallback
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject("No 2d context");
                return;
            }
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(url);
            reject(e);
        };
        img.src = url;
    });
}

// Helper to map DB Budget to PDF Data
export const mapToPdfData = (budget: Presupuesto & any, companyInfo: any, providerProfile: any | null, signaturePng?: string): QuotePdfData => {
    // Provider Profile Logic
    const compName = providerProfile?.fullName || providerProfile?.nombre || companyInfo.name || "Prestador";
    const compAddr = providerProfile?.address || providerProfile?.direccion || "";
    const compPhone = providerProfile?.phone || providerProfile?.telefono || companyInfo.phone || "";
    const compEmail = providerProfile?.email || companyInfo.email || "";

    // Client fallbacks
    const clientName = budget.client?.name || budget.clienteSnapshot?.nombre || "Cliente";

    let clientAddress = "";
    if (Array.isArray(budget.client?.lines)) {
        clientAddress = budget.client.lines.join(", ");
    } else if (typeof budget.client?.address === 'string') {
        clientAddress = budget.client.address;
    } else {
        clientAddress = budget.clienteSnapshot?.direccion || "";
    }

    const clientPhone = budget.client?.phone || budget.clienteSnapshot?.telefono || "";
    const clientEmail = budget.client?.email || budget.clienteSnapshot?.email || "";

    // Dates
    const issueDate = budget.date ? formatDate(budget.date) : formatDate(budget.createdAt);

    let validUntilStr = "-";
    if (budget.validUntil) {
        validUntilStr = formatDate(budget.validUntil);
    } else if (budget.createdAt) {
        const d = toDate(budget.createdAt);
        if (d) {
            const days = safeNum(budget.validezDias) || 15;
            d.setDate(d.getDate() + days);
            validUntilStr = d.toLocaleDateString();
        }
    }

    return {
        companyName: compName,
        companyAddress: compAddr,
        companyPhone: compPhone,
        companyEmail: compEmail,

        clientName,
        clientAddress,
        clientPhone,
        clientEmail,

        budgetNumber: String(budget.numero ?? budget.number ?? "S/N"),
        issueDate,
        validUntil: validUntilStr,
        workTitle: budget.title || budget.titulo || "Presupuesto",

        items: (budget.items || []).map((i: any, idx: number) => {
            const qty = safeNum(i.cantidad ?? i.quantity);
            const price = safeNum(i.precioUnitario ?? i.unitPrice);
            const total = safeNum(i.total) || (qty * price);

            return {
                id: String(i.id ?? `item-${idx}`),
                description: i.descripcion || i.task || i.description || "—",
                unit: i.unidad || i.unit || "",
                quantity: qty,
                unitPrice: price,
                total: total
            };
        }),

        materials: (budget.materials || []).map((m: any, idx: number) => {
            const qty = safeNum(m.cantidad ?? m.quantity);
            const price = safeNum(m.precioUnitario ?? m.unitPrice);
            const total = safeNum(m.subtotal ?? m.total) || (qty * price);

            return {
                id: String(m.id ?? `mat-${idx}`),
                description: m.name || m.nombre || "Sin nombre",
                unit: m.unidad || m.unit || "",
                quantity: qty,
                unitPrice: price,
                total: total
            };
        }),

        subtotal: safeNum(budget.subtotal),
        discount: safeNum(budget.descuentoGlobal),
        total: safeNum(budget.total),

        excludedItems: budget.notQuotedItems || budget.excludedItems || [],

        clarifications: budget.clarificationsText || budget.clarifications || "",
        conditions: budget.conditionsText || budget.conditions || "",
        notes: budget.notesText || budget.notes || "",

        paymentConditions: budget.paymentConditionsText || budget.paymentConditions || "",
        paymentMethod: budget.paymentMethodText || budget.paymentMethod || "",

        logoBase64: undefined,
        signatureBase64: signaturePng
    };
};
