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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, FileText, CheckCircle, Eye, Pencil, Trash2 } from 'lucide-react';
import { PdfPreviewModal } from '@/components/quotes/PdfPreviewModal';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { approveBudget } from '@/lib/logic/budget-actions';
import { ProviderProfileService } from '@/lib/services/providerProfile';

import { mapToPdfData, convertSvgToPng } from '@/lib/pdf/mapper';

export default function QuotesPage() {
    const { tenantId, isAuthenticated, user } = useTenant();
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
            // 1. Fetch Full Quote Data
            const fullBudget = await QuotesService.getById(budget.id);

            // 2. Fetch Provider Profile
            const profile = await ProviderProfileService.getProfile();

            // 3. Handle Signature
            let pngSig = undefined;
            if (profile?.signature?.svg) {
                try {
                    pngSig = await convertSvgToPng(profile.signature.svg);
                } catch (e) {
                    console.warn("Signature conversion failed", e);
                }
            }

            // 4. Map Data
            const pdfData = mapToPdfData(fullBudget || budget, { name: user?.displayName }, profile, pngSig);

            setPreviewData(pdfData);
            setPreviewFileName(`Presupuesto-${budget.numero || 'X'}-${budget.clienteSnapshot.nombre}`);
            setPreviewOpen(true);
        } catch (error) {
            console.error("PDF Prep Error", error);
            alert("Error general al preparar PDF. Intente nuevamente.");
        } finally {
            setGeneratingPdf(null);
        }
    };

    // --- Delete Logic ---
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteClick = (budget: Presupuesto) => {
        setDeleteId(budget.id);
    };

    const confirmDelete = async () => {
        if (!deleteId || !tenantId) return;
        setDeleting(true);
        try {
            await QuotesService.delete(deleteId);
            setDeleteId(null);
            await loadQuotes(); // Refresh list
            // toast.success("Presupuesto eliminado"); // Add toast if available
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar el presupuesto");
        } finally {
            setDeleting(false);
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
                <div className="rounded-md border bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px]">Fecha</TableHead>
                                <TableHead>Título</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="w-[70px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {quotes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        No hay presupuestos registrados.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                quotes.map((q) => (
                                    <TableRow key={q.id} className="hover:bg-muted/50">
                                        <TableCell className="font-medium">
                                            {q.createdAt ? new Date(q.createdAt).toLocaleDateString() : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{q.titulo || "Sin título"}</span>
                                                <span className="text-xs text-muted-foreground">{q.numero}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{q.clienteSnapshot?.nombre || "Cliente desconocido"}</TableCell>
                                        <TableCell>
                                            <Badge variant={
                                                q.estado === 'approved' ? 'default' :
                                                    q.estado === 'pending' ? 'secondary' : 'outline'
                                            } className={
                                                q.estado === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-200 border-0' :
                                                    q.estado === 'pending' ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 border-0' :
                                                        'text-muted-foreground'
                                            }>
                                                {q.estado === 'approved' ? 'Aprobado' :
                                                    q.estado === 'pending' ? 'Pendiente' : 'Borrador'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            ${(q.total || 0).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-2">
                                                {generatingPdf === q.id && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/quotes/${q.id}`}>
                                                            <Eye className="mr-2 h-4 w-4" /> Ver detalle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/quotes/${q.id}/edit`}>
                                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handlePreviewPdf(q)}>
                                                            <FileText className="mr-2 h-4 w-4" /> PDF
                                                        </DropdownMenuItem>
                                                        {(q.estado === 'draft' || q.estado === 'pending') && (
                                                            <>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => handleApprove(q)} className="text-green-600 focus:text-green-700 focus:bg-green-50">
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                                                                </DropdownMenuItem>
                                                            </>
                                                        )}
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => handleDeleteClick(q)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                            <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                                        </DropdownMenuItem>
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

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                onConfirm={confirmDelete}
                title="¿Eliminar presupuesto?"
                description="Esta acción eliminará el presupuesto permanentemente."
                loading={deleting}
            />
        </div>
    );
}
