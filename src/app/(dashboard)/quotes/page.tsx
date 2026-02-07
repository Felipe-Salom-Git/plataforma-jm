'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { QuotesService } from '@/lib/services/quotes';
import type { Presupuesto } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, CheckCircle, Eye, Pencil } from 'lucide-react';
import { PdfPreviewModal } from '@/components/quotes/PdfPreviewModal';
import { approveBudget } from '@/lib/logic/budget-actions';
import { ProviderProfileService } from '@/lib/services/providerProfile';

// Helper for mapping (duplicated from Detail page, ideally shared)
// simplified for list purposes
const mapListToPdfData = (budget: Presupuesto, providerProfile: any) => {
    return {
        companyName: providerProfile?.fullName || "Mi Empresa",
        companyAddress: providerProfile?.address || "",
        companyPhone: providerProfile?.phone || "",
        companyEmail: providerProfile?.email || "",

        clientName: budget.clienteSnapshot?.nombre || "Cliente",
        clientAddress: budget.clienteSnapshot?.direccion || "",
        clientPhone: budget.clienteSnapshot?.telefono || "",
        clientEmail: budget.clienteSnapshot?.email || "",

        budgetNumber: budget.numero || "S/N",
        issueDate: budget.createdAt ? new Date(budget.createdAt).toLocaleDateString() : '-',
        validUntil: budget.createdAt ? new Date(budget.createdAt + ((budget.validezDias || 15) * 24 * 60 * 60 * 1000)).toLocaleDateString() : '-',
        workTitle: budget.titulo,

        items: (budget.items || []).map(i => ({
            id: i.id,
            description: i.descripcion,
            unit: i.unidad,
            quantity: i.cantidad,
            unitPrice: i.precioUnitario,
            total: i.total
        })),

        subtotal: budget.subtotal || 0,
        discount: budget.descuentoGlobal || 0,
        total: budget.total || 0,

        excludedItems: budget.notQuotedItems || [],
        clarifications: (budget as any).clarificationsText || (budget as any).clarifications || budget.observaciones || "Sin observaciones.",
        paymentConditions: (budget as any).paymentConditionsText || budget.condicionesPago || "A convenir.",
        paymentMethod: (budget as any).paymentMethodText || budget.paymentMethod || "Efectivo",

        logoBase64: undefined,
        signatureBase64: undefined
    };
};

export default function QuotesPage() {
    const { tenantId, isAuthenticated } = useTenant();
    const [quotes, setQuotes] = useState<Presupuesto[]>([]);
    const [loading, setLoading] = useState(true);

    // PDF Preview State
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState<any>(null);
    const [previewFileName, setPreviewFileName] = useState("");
    const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

    // Approve State
    const [approving, setApproving] = useState<string | null>(null);

    useEffect(() => {
        if (tenantId) {
            loadQuotes();
        }
    }, [tenantId]);

    const loadQuotes = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const data = await QuotesService.listByStatus();
            setQuotes(data as any);
        } catch (error) {
            console.error("Error loading quotes", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (budget: Presupuesto) => {
        if (!tenantId) return;
        if (!confirm(`¿Aprobar presupuesto "${budget.titulo}"?`)) return;

        setApproving(budget.id);
        try {
            await approveBudget(tenantId, budget.id);
            await loadQuotes(); // Refresh
        } catch (err) {
            console.error(err);
            alert("Error al aprobar");
        } finally {
            setApproving(null);
        }
    };

    const handlePreviewPdf = async (budget: Presupuesto) => {
        setGeneratingPdf(budget.id);
        try {
            // Fetch provider profile on demand for PDF
            const profile = await ProviderProfileService.getProfile();
            const pdfData = mapListToPdfData(budget, profile);

            setPreviewData(pdfData);
            setPreviewFileName(`Presupuesto-${budget.numero || 'X'}-${budget.clienteSnapshot.nombre}`);
            setPreviewOpen(true);
        } catch (error) {
            console.error("PDF Prep Error", error);
            alert("Error preparando PDF");
        } finally {
            setGeneratingPdf(null);
        }
    };

    if (!isAuthenticated) return <div>Acceso denegado. Inicia sesión.</div>;

    return (
        <div className="p-8 container mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Presupuestos</h1>
                    <p className="text-muted-foreground">Gestiona tus cotizaciones y obras.</p>
                </div>
                <Button onClick={() => window.location.href = '/quotes/new'}>
                    <span className="mr-2">+</span> Nuevo Presupuesto
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="bg-white rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Número</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Obra / Título</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No hay presupuestos registrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                quotes.map((q) => (
                                    <TableRow key={q.id}>
                                        <TableCell className="font-medium">{q.numero || "—"}</TableCell>
                                        <TableCell>{q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '-'}</TableCell>
                                        <TableCell>{q.titulo}</TableCell>
                                        <TableCell>
                                            <a href={`/quotes/${q.id}`} className="hover:underline text-primary font-medium">
                                                {q.clienteSnapshot?.nombre || "Cliente"}
                                            </a>
                                        </TableCell>
                                        <TableCell>${(q.total || 0).toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                q.estado === 'approved' ? 'default' :
                                                    q.estado === 'draft' ? 'secondary' : 'outline'
                                            } className={
                                                q.estado === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''
                                            }>
                                                {q.estado === 'draft' ? 'Borrador' :
                                                    q.estado === 'approved' ? 'Aprobado' :
                                                        q.estado === 'pending' ? 'Pendiente' : q.estado}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {/* Quick PDF Action */}
                                                <Button variant="ghost" size="icon" onClick={() => handlePreviewPdf(q)} disabled={!!generatingPdf}>
                                                    {generatingPdf === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-slate-500" />}
                                                </Button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/quotes/${q.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/quotes/${q.id}/edit`}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handlePreviewPdf(q)}>
                                                            <FileText className="mr-2 h-4 w-4" /> Previsualizar PDF
                                                        </DropdownMenuItem>

                                                        {(q.estado === 'draft' || q.estado === 'pending') && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => handleApprove(q)} className="text-green-600 focus:text-green-700">
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            <PdfPreviewModal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                data={previewData}
                fileName={previewFileName}
            />
        </div>
    );
}
