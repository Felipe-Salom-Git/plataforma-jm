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
    FileText,
    Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { QuotePdfData } from '@/lib/pdf/generateQuotePdf';
import { PaymentModal } from '@/components/quotes/PaymentModal';
import { mapToPdfData, convertSvgToPng, formatDate, safeNum, toDate } from '@/lib/pdf/mapper';

// --- Helpers ---
// (Removed local helpers - imported from mapper)

// Helper to map DB Budget to PDF Data
// (Removed local mapToPdfData - imported from mapper)

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
            await loadData(); // Reload
            toast.success("Aprobado y enviado a seguimiento ✅");
        } catch (error) {
            console.error("Error approving", error);
            toast.error("Error al aprobar.");
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
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                {budget.titulo ?? (budget as any).title ?? (budget as any).workTitle ?? "Presupuesto"}
                            </h1>
                            <Badge variant="outline" className={
                                budget.estado === 'approved' ? 'bg-green-100 text-green-800 border-green-200 uppercase' :
                                budget.estado === 'pending' ? 'bg-yellow-100 text-yellow-900 border-yellow-200 uppercase' :
                                'bg-slate-100 text-slate-800 border-slate-200 uppercase'
                            }>
                                {budget.estado === 'draft' ? 'Borrador' :
                                 budget.estado === 'approved' ? 'Aprobado' :
                                 budget.estado === 'pending' ? 'Pendiente' : budget.estado}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">#{budget.numero || 'BORRADOR'} • {formatDate((budget as any).date || budget.createdAt)}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => router.push(`/quotes/${budget.id}/edit`)} className="bg-white text-black border-gray-300 hover:bg-gray-50">
                        <PencilIcon className="mr-2 h-4 w-4" /> Editar
                    </Button>

                    <Button variant="outline" onClick={() => setPdfModalOpen(true)} className="bg-white text-black border-gray-300 hover:bg-gray-50">
                        <FileText className="mr-2 h-4 w-4" /> PDF
                    </Button>

                    {budget.trackingId && (
                        <Button variant="outline" onClick={() => router.push(`/trackings/${budget.trackingId}`)} className="bg-white text-blue-700 border-blue-200 hover:bg-blue-50">
                            <Activity className="mr-2 h-4 w-4" /> Ir a Seguimiento
                        </Button>
                    )}

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
// (Removed local convertSvgToPng - imported from mapper)
