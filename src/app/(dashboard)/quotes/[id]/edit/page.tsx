"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTenant } from "@/lib/hooks/useTenant";
import { QuotesService } from "@/lib/services/quotes";
import QuoteForm from "@/components/quotes/QuoteForm";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditQuotePage() {
    const { id } = useParams();
    const router = useRouter();
    const { tenantId, isAuthenticated } = useTenant();
    const [quote, setQuote] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tenantId && id) {
            loadQuote();
        }
    }, [tenantId, id]);

    const loadQuote = async () => {
        try {
            // @ts-ignore: getById returns Presupuesto compatible object
            const data = await QuotesService.getById(id as string);
            setQuote(data);
        } catch (error) {
            console.error("Error loading quote", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) return <div>Acceso denegado</div>;
    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (!quote) return <div className="p-8">Presupuesto no encontrado</div>;

    return (
        <div className="container mx-auto py-6">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <h1 className="text-2xl font-bold">Editar Presupuesto #{quote.numero || "S/N"}</h1>
            </div>

            <QuoteForm initialData={quote} quoteId={quote.id} />
        </div>
    );
}
