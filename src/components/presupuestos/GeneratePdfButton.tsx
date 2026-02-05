'use client';

import { useState } from 'react';
import { generateQuotePdf, QuotePdfData } from '@/lib/pdf/generateQuotePdf';
import { Button } from '@/components/ui/button';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Loader2, FileDown } from 'lucide-react';

interface GeneratePdfButtonProps {
    data: QuotePdfData;
    presupuestoId: string;
    userId: string;
    onSuccess?: (url: string) => void;
}

export function GeneratePdfButton({ data, presupuestoId, userId, onSuccess }: GeneratePdfButtonProps) {
    const [loading, setLoading] = useState(false);

    const handleGenerate = async () => {
        try {
            setLoading(true);
            
            // 1. Generate PDF Blob
            const pdfBytes = await generateQuotePdf(data);
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            // 2. Download Locally (Optional, good for UX)
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Presupuesto-${data.budgetNumber}.pdf`;
            link.click();
            
            // 3. Upload to Firebase Storage
            const storage = getStorage();
            const storageRef = ref(storage, `users/${userId}/presupuestos/${presupuestoId}.pdf`);
            
            await uploadBytes(storageRef, blob);
            const downloadUrl = await getDownloadURL(storageRef);
            
            // 4. Update Firestore
            await updateDoc(doc(db, 'users', userId, 'presupuestos', presupuestoId), {
                pdfUrl: downloadUrl,
                estado: 'pending', // Auto-transition
                updatedAt: Date.now()
            });

            if (onSuccess) onSuccess(downloadUrl);

        } catch (error) {
            console.error("Error generating/uploading PDF", error);
            alert("Hubo un error generando el PDF.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button onClick={handleGenerate} disabled={loading}>
            {loading ? (
                <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                </>
            ) : (
                <>
                    <FileDown className="mr-2 h-4 w-4" />
                    Generar PDF
                </>
            )}
        </Button>
    );
}
