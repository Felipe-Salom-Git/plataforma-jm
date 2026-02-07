'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/hooks/useTenant';
import { QuotesService } from '@/lib/services/quotes';
import { approveBudget } from '@/lib/logic/budget-actions';
import { Presupuesto } from '@/lib/types';
import { PdfPreviewModal } from '@/components/quotes/PdfPreviewModal';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
    Loader2,
    ArrowLeft,
    CheckCircle,
    Calendar,
    User,
    MapPin,
    CreditCard,
    Pencil as PencilIcon,
    FileText
} from 'lucide-react';
import { QuotePdfData } from '@/lib/pdf/generateQuotePdf';
import { PaymentModal } from '@/components/quotes/PaymentModal';

// --- Helpers ---
const toDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value.toDate === 'function') return value.toDate(); // Firestore Timestamp
    if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
        // Handle YYYY-MM-DD to prevent timezone issues if possible, or just standard new Date
        return new Date(value);
    }
    return null;
};

const formatDate = (value: any): string => {
    const d = toDate(value);
    if (!d || isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
};

// Utility to clean numbers
const safeNum = (val: any): number => {
    const n = Number(val);
    return Number.isFinite(n) ? n : 0;
};

// Helper to map DB Budget to PDF Data
const mapToPdfData = (budget: Presupuesto & any, companyInfo: any, providerProfile: any | null, signaturePng?: string): QuotePdfData => {
    // Provider Profile Logic
    // User requested: providerName = profile.fullName ?? profile.nombre ?? user.displayName ?? "Prestador"
    const compName = providerProfile?.fullName || providerProfile?.nombre || companyInfo.name || "Prestador";
    const compAddr = providerProfile?.address || providerProfile?.direccion || "";
    const compPhone = providerProfile?.phone || providerProfile?.telefono || "";
    const compEmail = providerProfile?.email || "";

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

        items: [
            ...(budget.items || []).map((i: any, idx: number) => {
                const qty = safeNum(i.cantidad ?? i.quantity);
                const price = safeNum(i.precioUnitario ?? i.unitPrice);
                const total = safeNum(i.total) || (qty * price); // Fallback calculation

                return {
                    id: String(i.id ?? `item-${idx}`),
                    description: i.descripcion || i.task || i.description || "—",
                    unit: i.unidad || i.unit || "",
                    quantity: qty,
                    unitPrice: price,
                    total: total
                };
            }),
            ...(budget.materials || []).map((m: any, idx: number) => {
                const qty = safeNum(m.cantidad ?? m.quantity);
                const price = safeNum(m.precioUnitario ?? m.unitPrice);
                const total = safeNum(m.subtotal ?? m.total) || (qty * price);

                return {
                    id: String(m.id ?? `mat-${idx}`),
                    description: `Material: ${m.name || m.nombre || "Sin nombre"}`,
                    unit: m.unidad || m.unit || "",
                    quantity: qty,
                    unitPrice: price,
                    total: total
                };
            })
        ],

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

export default function BudgetDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { tenantId, user, isAuthenticated } = useTenant();

    const [budget, setBudget] = useState<Presupuesto | null>(null);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState(false);

    // Provider Profile State
    const [providerProfile, setProviderProfile] = useState<any>(null);
    const [signaturePng, setSignaturePng] = useState<string | undefined>(undefined);

    // PDF Preview Modal State
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfData, setPdfData] = useState<QuotePdfData | null>(null);

    useEffect(() => {
        if (tenantId && id) {
            loadData();
        }
    }, [tenantId, id]);

    const loadData = async () => {
        if (!tenantId || !id) return;
        try {
            // Parallel fetch
            const [budgetData, profileData] = await Promise.all([
                QuotesService.getById(id as string),
                import('@/lib/services/providerProfile').then(mod => mod.ProviderProfileService.getProfile())
            ]);

            setBudget(budgetData);
            setProviderProfile(profileData);

            // Handle Signature Conversion
            let pngSig = undefined;
            if (profileData?.signature?.svg) {
                try {
                    pngSig = await convertSvgToPng(profileData.signature.svg);
                    setSignaturePng(pngSig);
                } catch (err) {
                    console.error("Failed to convert signature SVG to PNG", err);
                }
            }

            // Prepare PDF Data immediately or on demand
            if (budgetData) {
                // Pass providerProfile to mapping to ensure correct data
                const mapped = mapToPdfData(budgetData, { name: user?.displayName }, profileData, pngSig);
                setPdfData(mapped);
            }

        } catch (error) {
            console.error("Error fetching data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!tenantId || !budget) return;
        if (!confirm("¿Estás seguro de aprobar este presupuesto? Esto reservará stock.")) return;

        setApproving(true);
        try {
            await approveBudget(tenantId, budget.id);
            loadData(); // Reload
            alert("Presupuesto aprobado correctamente.");
        } catch (error) {
            console.error("Error approving", error);
            alert("Error al aprobar.");
        } finally {
            setApproving(false);
        }
    };

    if (!isAuthenticated) return <div>Acceso denegado</div>;
    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
    if (!budget) return <div className="p-8">Presupuesto no encontrado</div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl">
            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            {budget.titulo}
                            <Badge variant={budget.estado === 'approved' ? 'default' : 'secondary'} className="uppercase">
                                {budget.estado}
                            </Badge>
                        </h1>
                        <p className="text-sm text-muted-foreground">#{budget.numero || 'BORRADOR'} • Creado el {formatDate((budget as any).date || budget.createdAt)}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push(`/quotes/${budget.id}/edit`)}>
                        <PencilIcon className="mr-2 h-4 w-4" /> Editar
                    </Button>

                    <Button variant="outline" onClick={() => setPdfModalOpen(true)}>
                        <FileText className="mr-2 h-4 w-4" /> PDF
                    </Button>

                    {budget.estado === 'pending' || budget.estado === 'draft' ? (
                        <Button onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
                            {approving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                            Aprobar Presupuesto
                        </Button>
                    ) : null}
                </div>
            </div>

            {
                !providerProfile && (
                    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm flex items-center gap-2">
                        No has configurado tu Perfil de Prestador. Los PDFs saldrán con datos genéricos.
                        <a href="/config" className="underline font-semibold">Configurar ahora</a>.
                    </div>
                )
            }

            <PdfPreviewModal
                open={pdfModalOpen}
                onClose={() => setPdfModalOpen(false)}
                data={pdfData}
                fileName={`Presupuesto-${budget.numero}-${budget.clienteSnapshot.nombre}`}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Content (Items) */}
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Ítems del Presupuesto</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50">
                                        <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                            <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Descripción</th>
                                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Cant.</th>
                                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Unitario</th>
                                            <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(budget.items || []).map((item: any, idx) => {
                                            const desc = item.descripcion || item.task || item.description || "—";
                                            const qty = safeNum(item.cantidad ?? item.quantity);
                                            const unit = item.unidad || item.unit || "";
                                            const unitPrice = safeNum(item.precioUnitario ?? item.unitPrice);
                                            const total = safeNum(item.total ?? (qty * unitPrice));
                                            const type = item.tipo || item.type || "";

                                            return (
                                                <tr key={item.id || `item-${idx}-${desc}`} className="border-b transition-colors hover:bg-muted/50">
                                                    <td className="p-4 align-middle">
                                                        <div className="font-medium">{desc}</div>
                                                        <div className="text-xs text-muted-foreground capitalize">{type}</div>
                                                    </td>
                                                    <td className="p-4 align-middle text-right">{qty} {unit}</td>
                                                    <td className="p-4 align-middle text-right">${(unitPrice).toLocaleString()}</td>
                                                    <td className="p-4 align-middle text-right font-bold">${(total).toLocaleString()}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Totals Section */}
                            <div className="flex flex-col gap-2 items-end p-6">
                                <div className="flex gap-12 text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span>${safeNum(budget.subtotal).toLocaleString()}</span>
                                </div>
                                {safeNum(budget.descuentoGlobal) > 0 && (
                                    <div className="flex gap-12 text-red-500">
                                        <span>Descuento</span>
                                        <span>-${safeNum(budget.descuentoGlobal).toLocaleString()}</span>
                                    </div>
                                )}
                                <Separator className="my-2 w-1/3" />
                                <div className="flex gap-12 text-lg font-bold">
                                    <span>Total Final</span>
                                    <span>${safeNum(budget.total).toLocaleString()}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* MATERIALS (If any) */}
                    {budget.materials && budget.materials.length > 0 && (
                        <Card>
                            <CardHeader><CardTitle>Materiales Estimados</CardTitle></CardHeader>
                            <CardContent className="p-0">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left">Material</th>
                                            <th className="px-4 py-2 text-right">Cant.</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(budget.materials || []).map((m: any, idx: number) => {
                                            const name = m.name || m.nombre || "Sin nombre";
                                            const qty = safeNum(m.quantity ?? m.cantidad);
                                            const total = safeNum(m.subtotal ?? m.total);

                                            return (
                                                <tr key={m.id || `mat-${idx}-${name}`} className="border-b">
                                                    <td className="px-4 py-2">{name}</td>
                                                    <td className="px-4 py-2 text-right">{qty}</td>
                                                    <td className="px-4 py-2 text-right">${total}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader><CardTitle>Condiciones y Notas</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Aclaraciones</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{(budget as any).clarificationsText || (budget as any).clarifications || budget.observaciones || "Sin observaciones"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Condiciones Generales</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{(budget as any).conditionsText || (budget as any).conditions || "-"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Notas al Cliente</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{(budget as any).notesText || (budget as any).notes || "-"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Condiciones de Pago</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{(budget as any).paymentConditionsText || (budget as any).paymentConditions || budget.condicionesPago || "No especificado"}</p>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Método de Pago</h4>
                                <p className="text-sm text-gray-600 whitespace-pre-wrap">{(budget as any).paymentMethodText || (budget as any).paymentMethod || "-"}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar (Meta Info) */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <User className="h-4 w-4" /> Cliente
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <div className="font-semibold">{budget.clienteSnapshot.nombre}</div>
                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                    <MapPin className="h-3 w-3" />
                                    {budget.clienteSnapshot.direccion || "Sin dirección"}
                                </div>
                                {budget.clienteSnapshot.telefono && (
                                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                        <span className="text-xs">📞</span> {budget.clienteSnapshot.telefono}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Fechas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Emitido:</span>
                                <span>{formatDate((budget as any).date || budget.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Válido hasta:</span>
                                <span>{
                                    (budget as any).validUntil
                                        ? formatDate((budget as any).validUntil)
                                        : (budget.createdAt ? formatDate(new Date(toDate(budget.createdAt)!.getTime() + (safeNum(budget.validezDias || 15) * 24 * 60 * 60 * 1000))) : '-')
                                }</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Actualizado:</span>
                                <span>{formatDate(budget.updatedAt)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {(budget.estado === 'in_progress' || budget.estado === 'completed') && (
                        <Card className="bg-blue-50 border-blue-100">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                                    <CreditCard className="h-4 w-4" /> Pagos
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-700">
                                    ${(safeNum(budget.total) - safeNum(budget.saldoPendiente)).toLocaleString()}
                                </div>
                                <div className="text-xs text-blue-600 mt-1">
                                    Pendiente: ${safeNum(budget.saldoPendiente).toLocaleString()}
                                </div>
                                <div className="mt-4">
                                    <PaymentModal
                                        tenantId={tenantId!}
                                        budget={{ id: budget.id, saldoPendiente: budget.saldoPendiente, total: budget.total }}
                                        onSuccess={loadData}
                                        trigger={
                                            <Button variant="outline" size="sm" className="w-full bg-white border-blue-200 text-blue-700 hover:bg-blue-100">
                                                Registrar Pago
                                            </Button>
                                        }
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}

// Utility to convert SVG string to PNG Data URI
async function convertSvgToPng(svgString: string): Promise<string> {
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
