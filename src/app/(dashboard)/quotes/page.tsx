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
                                            <Badge variant="outline" className={
                                                q.estado === 'approved' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' :
                                                q.estado === 'pending' ? 'bg-yellow-100 text-yellow-900 border-yellow-200 hover:bg-yellow-100' :
                                                'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-100'
                                            }>
                                                {q.estado === 'draft' ? 'Borrador' :
                                                    q.estado === 'approved' ? 'Aprobado' :
                                                        q.estado === 'pending' ? 'Pendiente' : q.estado}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end items-center gap-2">
                                                {/* Quick PDF Action */}
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    onClick={() => handlePreviewPdf(q)} 
                                                    disabled={!!generatingPdf}
                                                    className="bg-white text-black border border-gray-300 hover:bg-gray-50 h-8 w-8"
                                                >
                                                    {generatingPdf === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4 text-slate-700" />}
                                                </Button>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="bg-white text-black border border-gray-300 hover:bg-gray-50 h-8 w-8">
                                                            <MoreHorizontal className="h-4 w-4 text-slate-700" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="bg-white text-black border border-gray-200">
                                                        <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/quotes/${q.id}`} className="focus:bg-gray-100 focus:text-black cursor-pointer">
                                                            <Eye className="mr-2 h-4 w-4" /> Ver Detalle
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/quotes/${q.id}/edit`} className="focus:bg-gray-100 focus:text-black cursor-pointer">
                                                            <Pencil className="mr-2 h-4 w-4" /> Editar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handlePreviewPdf(q)} className="focus:bg-gray-100 focus:text-black cursor-pointer">
                                                            <FileText className="mr-2 h-4 w-4" /> Previsualizar PDF
                                                        </DropdownMenuItem>

                                                        {(q.estado === 'draft' || q.estado === 'pending') && (
                                                            <>
                                                                <DropdownMenuSeparator className="bg-gray-200" />
                                                                <DropdownMenuItem onClick={() => handleApprove(q)} className="text-green-600 focus:text-green-700 focus:bg-green-50 cursor-pointer">
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
