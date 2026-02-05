'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { QuotesService } from '@/lib/services/quotes';
import type { Presupuesto } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function QuotesPage() {
  const { tenantId, isAuthenticated } = useTenant();
  const [quotes, setQuotes] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadQuotes();
    }
  }, [tenantId]);

  const loadQuotes = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await QuotesService.listByStatus(tenantId);
      setQuotes(data);
    } catch (error) {
        console.error("Error loading quotes", error);
    } finally {
        setLoading(false);
    }
  };

  if (!isAuthenticated) return <div>Acceso denegado. Inicia sesión.</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Presupuestos</h1>
        <Button onClick={() => alert("Crear nuevo...")}>+ Nuevo Presupuesto</Button>
      </div>

      {loading ? (
        <Loader2 className="animate-spin" />
      ) : (
        <div className="grid gap-4">
            {quotes.length === 0 && <p className="text-gray-500">No hay presupuestos recientes.</p>}
            
            {quotes.map((q) => (
                <div key={q.id} className="p-4 border rounded shadow-sm hover:shadow-md transition">
                    <div className="font-bold flex justify-between">
                        <span>{q.titulo}</span>
                        <span className="text-sm bg-gray-100 px-2 py-1 rounded">{q.estado}</span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                        Cliente: {q.clienteSnapshot.nombre} | Total: ${q.total}
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  );
}
