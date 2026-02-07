'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileDown, X } from 'lucide-react';
import { generateQuotePdf, QuotePdfData } from '@/lib/pdf/generateQuotePdf';

interface PdfPreviewModalProps {
    open: boolean;
    onClose: () => void;
    data: QuotePdfData | null;
    fileName: string;
}

export function PdfPreviewModal({ open, onClose, data, fileName }: PdfPreviewModalProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && data) {
            generate(data);
        } else {
            setPdfUrl(null); // Cleanup
        }
    }, [open, data]);

    const generate = async (pdfData: QuotePdfData) => {
        setLoading(true);
        try {
            const pdfBytes = await generateQuotePdf(pdfData);
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
        } catch (error) {
            console.error("Error generating PDF preview", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = () => {
        if (!pdfUrl) return;
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
        link.click();
    };

    return (
        <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle className="flex items-center justify-between">
                        <span>Vista Previa PDF</span>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleDownload} disabled={!pdfUrl || loading}>
                                <FileDown className="mr-2 h-4 w-4" />
                                Descargar
                            </Button>

                        </div>
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 bg-slate-100 p-4 overflow-hidden relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : pdfUrl ? (
                        <iframe
                            src={pdfUrl}
                            className="w-full h-full rounded border shadow-sm"
                            title="PDF Preview"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No se pudo generar la vista previa.
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
