import { useEffect, useState } from "react";
import { QuotesService } from "@/lib/services/quotes";
import { Presupuesto } from "@/lib/types";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, X, FileDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { generateQuotePdf } from "@/lib/pdf/generateQuotePdf";
import { mapToPdfData, convertSvgToPng } from "@/lib/pdf/mapper";
import { ProviderProfileService } from "@/lib/services/providerProfile";
import { useTenant } from "@/lib/hooks/useTenant";
import { toast } from "sonner";

interface QuotePreviewModalProps {
    quoteId?: string;
    quoteSnapshot?: any;
}

export function QuotePreviewModal({ quoteId, quoteSnapshot }: QuotePreviewModalProps) {
    const { user } = useTenant();
    const [open, setOpen] = useState(false);
    const [quote, setQuote] = useState<any | null>(null); // Using any to handle mixed schema versions comfortably
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [generatingPdf, setGeneratingPdf] = useState(false);

    useEffect(() => {
        if (open) {
            if (quoteSnapshot) {
                setQuote(quoteSnapshot);
                setLoading(false);
                setError("");
            } else if (quoteId) {
                loadQuote();
            } else {
                setError("Información del presupuesto no disponible");
                setLoading(false);
            }
        }
    }, [open, quoteId, quoteSnapshot]);

    const loadQuote = async () => {
        if (!quoteId) return;
        setLoading(true);
        setError("");
        try {
            const data = await QuotesService.getById(quoteId);
            if (data) {
                setQuote(data);
            } else {
                setError("Presupuesto no encontrado en base de datos");
            }
        } catch (err) {
            console.error(err);
            setError("Error cargando presupuesto");
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPdf = async () => {
        if (!quote) return;
        setGeneratingPdf(true);
        try {
            // 1. Fetch Provider Profile
            const profileData = await ProviderProfileService.getProfile();

            // 2. Convert Signature if available
            let pngSig = undefined;
            if (profileData?.signature?.svg) {
                try {
                    pngSig = await convertSvgToPng(profileData.signature.svg);
                } catch (err) {
                    console.error("Failed to convert signature SVG to PNG", err);
                }
            }

            // 3. Map Data
            const pdfData = mapToPdfData(quote, { name: user?.displayName }, profileData, pngSig);

            // 4. Generate PDF
            const pdfBytes = await generateQuotePdf(pdfData);

            // 5. Download
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fileName = `Presupuesto-${quote.numero || "SN"}-${(quote.clienteSnapshot?.nombre || "Cliente").replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            link.download = fileName;
            link.click();
            window.URL.revokeObjectURL(url);

            toast.success("PDF descargado correctamente");

        } catch (error) {
            console.error("Error generating PDF", error);
            toast.error("Error generando el PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    // Helper for safe currency
    const fmt = (n?: number) => (n || 0).toLocaleString();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!quoteId && !quoteSnapshot} className="gap-2">
                    <FileText className="h-4 w-4" />
                    Ver Presupuesto Original
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader className="flex flex-row items-center justify-between pr-8">
                    <DialogTitle>Presupuesto Original {quoteSnapshot ? "(Snapshot)" : ""}</DialogTitle>
                    {quote && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleDownloadPdf}
                            disabled={generatingPdf}
                            className="gap-2"
                        >
                            {generatingPdf ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <FileDown className="h-4 w-4" />
                            )}
                            {generatingPdf ? "Generando..." : "Descargar PDF"}
                        </Button>
                    )}
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                ) : error ? (
                    <div className="text-center py-10 text-red-500">{error}</div>
                ) : quote ? (
                    <div className="space-y-8">
                        {/* 1. Header & Client */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{quote.titulo || (quote as any).title || "Sin Título"}</h3>
                                <p className="text-sm text-slate-500 font-medium mt-1">
                                    #{quote.numero} • {new Date(quote.createdAt).toLocaleDateString()}
                                </p>
                                <div className="mt-2 text-sm">
                                    <span className="text-slate-500">Validez: </span>
                                    <span className="font-medium">{quote.validezDias} días</span>
                                    {quote.validUntil && <span className="text-slate-400"> (hasta {new Date(quote.validUntil).toLocaleDateString()})</span>}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <Badge variant="outline" className="text-sm px-3 py-1 capitalize">
                                    {quote.estado === 'draft' ? 'Borrador' :
                                        quote.estado === 'pending' ? 'Pendiente' :
                                            quote.estado === 'approved' ? 'Aprobado' : quote.estado}
                                </Badge>
                            </div>
                        </div>

                        <Separator />

                        {/* 2. Client Details */}
                        <div className="bg-slate-50/80 p-4 rounded-lg border border-slate-100">
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Cliente</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="font-medium text-slate-900">{quote.clienteSnapshot?.nombre || "N/A"}</p>
                                    {quote.clienteSnapshot?.cuit && <p className="text-slate-500">CUIT: {quote.clienteSnapshot.cuit}</p>}
                                </div>
                                <div className="space-y-1 text-slate-600">
                                    {quote.clienteSnapshot?.email && <p className="flex items-center gap-2">✉ {quote.clienteSnapshot.email}</p>}
                                    {quote.clienteSnapshot?.telefono && <p className="flex items-center gap-2">📞 {quote.clienteSnapshot.telefono}</p>}
                                    {quote.clienteSnapshot?.direccion && <p className="flex items-center gap-2">📍 {quote.clienteSnapshot.direccion}</p>}
                                </div>
                            </div>
                        </div>

                        {/* 3. Items Table */}
                        <div>
                            <h4 className="font-semibold text-lg mb-3">Ítems / Tareas</h4>
                            <div className="border rounded-lg overflow-hidden shdaow-sm">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-100 text-slate-600 font-medium border-b">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Descripción</th>
                                            <th className="px-4 py-3 text-right w-24">Cant.</th>
                                            <th className="px-4 py-3 text-right w-32">Unitario</th>
                                            <th className="px-4 py-3 text-right w-32">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {(quote.items || []).map((item: any, i: number) => (
                                            <tr key={i} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-slate-900">{item.task || item.descripcion || "—"}</div>
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">
                                                    {item.quantity ?? item.cantidad ?? 0} {item.unit || item.unidad || ""}
                                                </td>
                                                <td className="px-4 py-3 text-right text-slate-600">
                                                    ${fmt(item.unitPrice ?? item.precioUnitario)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-slate-900">
                                                    ${fmt(item.total)}
                                                </td>
                                            </tr>
                                        ))}
                                        {(quote.items || []).length === 0 && (
                                            <tr><td colSpan={4} className="p-4 text-center text-slate-400">Sin ítems</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 4. Materials (Optional) */}
                        {quote.materials && quote.materials.length > 0 && (
                            <div>
                                <h4 className="font-semibold text-lg mb-3 flex items-center gap-2">
                                    Materiales <Badge variant="secondary" className="text-xs">Adicionales</Badge>
                                </h4>
                                <div className="border rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-100 text-slate-600 font-medium border-b">
                                            <tr>
                                                <th className="px-4 py-3 text-left">Material</th>
                                                <th className="px-4 py-3 text-right w-24">Cant.</th>
                                                <th className="px-4 py-3 text-right w-32">Unitario</th>
                                                <th className="px-4 py-3 text-right w-32">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {quote.materials.map((mat: any, i: number) => (
                                                <tr key={i} className="hover:bg-slate-50/50">
                                                    <td className="px-4 py-3 font-medium text-slate-900">{mat.name || mat.nombre}</td>
                                                    <td className="px-4 py-3 text-right text-slate-600">{mat.quantity ?? mat.cantidad} {mat.unit || ""}</td>
                                                    <td className="px-4 py-3 text-right text-slate-600">${fmt(mat.unitPrice ?? mat.precioUnitario)}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">${fmt(mat.total ?? mat.subtotal)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 5. Totals */}
                        <div className="flex justify-end pt-4">
                            <div className="w-72 bg-slate-50 p-4 rounded-lg space-y-3">
                                <div className="flex justify-between text-sm text-slate-600">
                                    <span>Subtotal</span>
                                    <span>${fmt(quote.subtotal)}</span>
                                </div>
                                {(quote.descuentoGlobal || 0) > 0 && (
                                    <div className="flex justify-between text-sm text-green-600 font-medium">
                                        <span>Descuento</span>
                                        <span>-${fmt(quote.descuentoGlobal)}</span>
                                    </div>
                                )}
                                <Separator />
                                <div className="flex justify-between text-xl font-bold text-slate-900">
                                    <span>Total</span>
                                    <span>${fmt(quote.total)}</span>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* 6. Text Sections (Grid) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                            {/* Left: Notes & Conditions */}
                            <div className="space-y-6">
                                {(quote.notes || quote.notas) && (
                                    <div>
                                        <h5 className="font-semibold text-sm text-slate-700 mb-2">Notas al Cliente</h5>
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 whitespace-pre-wrap">
                                            {quote.notes || quote.notas}
                                        </div>
                                    </div>
                                )}

                                {(quote.conditions || quote.condiciones) && (
                                    <div>
                                        <h5 className="font-semibold text-sm text-slate-700 mb-2">Términos y Condiciones</h5>
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 whitespace-pre-wrap">
                                            {quote.conditions || quote.condiciones}
                                        </div>
                                    </div>
                                )}

                                {(quote.clarifications || quote.observaciones) && (
                                    <div>
                                        <h5 className="font-semibold text-sm text-slate-700 mb-2">Aclaraciones / Observaciones</h5>
                                        <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded border border-slate-100 whitespace-pre-wrap">
                                            {quote.clarifications || quote.observaciones}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Payment & Internal */}
                            <div className="space-y-6">
                                {(quote.paymentMethod || quote.paymentConditions || quote.condicionesPago) && (
                                    <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                                        <h5 className="font-semibold text-sm text-blue-800 mb-3 flex items-center gap-2">
                                            ℹ Información de Pago
                                        </h5>
                                        <div className="space-y-2 text-sm">
                                            {quote.paymentMethod && (
                                                <div>
                                                    <span className="font-medium text-blue-900">Método: </span>
                                                    <span className="text-blue-800">{quote.paymentMethod}</span>
                                                </div>
                                            )}
                                            {(quote.paymentConditions || quote.condicionesPago) && (
                                                <div>
                                                    <span className="font-medium text-blue-900">Condiciones: </span>
                                                    <span className="text-blue-800">{quote.paymentConditions || quote.condicionesPago}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {quote.internalNotesText && (
                                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                                        <h5 className="font-semibold text-sm text-amber-800 mb-2 flex justify-between items-center">
                                            <span>Notas Internas</span>
                                            <Badge variant="outline" className="bg-amber-100 text-amber-700 text-[10px] border-amber-200">PRIVADO</Badge>
                                        </h5>
                                        <div className="text-sm text-amber-900 whitespace-pre-wrap">
                                            {quote.internalNotesText}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
