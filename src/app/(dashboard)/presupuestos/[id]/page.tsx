'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/hooks/useTenant';
import { QuotesService } from '@/lib/services/quotes';
import { approveBudget } from '@/lib/logic/budget-actions';
import { Presupuesto } from '@/lib/types';
import { GeneratePdfButton } from '@/components/presupuestos/GeneratePdfButton';

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
  CreditCard 
} from 'lucide-react';
import { QuotePdfData } from '@/lib/pdf/generateQuotePdf';
import { PaymentModal } from '@/components/presupuestos/PaymentModal';

// Helper to map DB Budget to PDF Data
const mapToPdfData = (budget: Presupuesto, companyInfo: any): QuotePdfData => {
  return {
    companyName: companyInfo.name || "Mi Empresa",
    companyAddress: companyInfo.address || "Dirección Empresa",
    companyPhone: companyInfo.phone || "Teléfono",
    companyEmail: companyInfo.email || "email@empresa.com",
    
    clientName: budget.clienteSnapshot.nombre,
    clientAddress: budget.clienteSnapshot.direccion || "",
    clientPhone: budget.clienteSnapshot.telefono || "",
    clientEmail: budget.clienteSnapshot.email || "",
    
    budgetNumber: budget.numero || "S/N",
    issueDate: new Date(budget.createdAt).toLocaleDateString(),
    validUntil: new Date(budget.createdAt + (budget.validezDias * 24 * 60 * 60 * 1000)).toLocaleDateString(),
    workTitle: budget.titulo,
    
    items: budget.items.map(i => ({
        id: i.id,
        description: i.descripcion,
        unit: i.unidad,
        quantity: i.cantidad,
        unitPrice: i.precioUnitario,
        total: i.total
    })),
    
    subtotal: budget.subtotal,
    discount: budget.descuentoGlobal,
    total: budget.total,
    
    excludedItems: [], // TODO: Add field to schema if needed
    clarifications: budget.observaciones || "Sin observaciones adicionales.",
    paymentConditions: budget.condicionesPago || "A convenir.",
    paymentMethod: "Efectivo / Transferencia",
    logoBase64: undefined // TODO: Add logic to fetch company logo
  };
};

export default function BudgetDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { tenantId, user, isAuthenticated } = useTenant();
  
  const [budget, setBudget] = useState<Presupuesto | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    if (tenantId && id) {
      loadBudget();
    }
  }, [tenantId, id]);

  const loadBudget = async () => {
    if (!tenantId || !id) return;
    try {
      const data = await QuotesService.getById(tenantId, id as string);
      setBudget(data);
    } catch (error) {
      console.error("Error fetching budget", error);
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
        await loadBudget(); // Reload to see status change
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

  const pdfData = mapToPdfData(budget, { name: user?.displayName }); // Simplified company info

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
                    <p className="text-sm text-muted-foreground">#{budget.numero || 'BORRADOR'} • Creado el {new Date(budget.createdAt).toLocaleDateString()}</p>
                </div>
            </div>

            <div className="flex gap-2">
                <GeneratePdfButton 
                    data={pdfData} 
                    presupuestoId={budget.id} 
                    userId={tenantId!} 
                    onSuccess={(url) => loadBudget()} // Reload to show PDF link if we wanted
                />
                
                {budget.estado === 'pending' || budget.estado === 'draft' ? (
                     <Button onClick={handleApprove} disabled={approving} className="bg-green-600 hover:bg-green-700">
                        {approving ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : <CheckCircle className="mr-2 h-4 w-4"/>}
                        Aprobar Presupuesto
                     </Button>
                ) : null}
            </div>
       </div>

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
                                    {budget.items.map((item) => (
                                        <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle">
                                                <div className="font-medium">{item.descripcion}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{item.tipo}</div>
                                            </td>
                                            <td className="p-4 align-middle text-right">{item.cantidad} {item.unidad}</td>
                                            <td className="p-4 align-middle text-right">${item.precioUnitario.toLocaleString()}</td>
                                            <td className="p-4 align-middle text-right font-bold">${item.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Totals Section */}
                        <div className="flex flex-col gap-2 items-end p-6">
                            <div className="flex gap-12 text-muted-foreground">
                                <span>Subtotal</span>
                                <span>${budget.subtotal.toLocaleString()}</span>
                            </div>
                            {budget.descuentoGlobal > 0 && (
                                <div className="flex gap-12 text-red-500">
                                    <span>Descuento</span>
                                    <span>-${budget.descuentoGlobal.toLocaleString()}</span>
                                </div>
                            )}
                             <Separator className="my-2 w-1/3" />
                            <div className="flex gap-12 text-lg font-bold">
                                <span>Total Final</span>
                                <span>${budget.total.toLocaleString()}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Condiciones y Notas</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h4 className="text-sm font-semibold mb-1">Condiciones de Pago</h4>
                            <p className="text-sm text-gray-600">{budget.condicionesPago || "No especificado"}</p>
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold mb-1">Observaciones</h4>
                            <p className="text-sm text-gray-600">{budget.observaciones || "Sin observaciones"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Sidebar (Meta Info) */}
            <div className="space-y-6">
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-center gap-2">
                             <User className="h-4 w-4"/> Cliente
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
                             <Calendar className="h-4 w-4"/> Fechas
                        </CardTitle>
                    </CardHeader>
                     <CardContent className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Emitido:</span>
                            <span>{new Date(budget.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Válido hasta:</span>
                            <span>{new Date(budget.createdAt + (budget.validezDias * 24 * 60 * 60 * 1000)).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Actualizado:</span>
                            <span>{new Date(budget.updatedAt).toLocaleDateString()}</span>
                        </div>
                    </CardContent>
                </Card>

                {(budget.estado === 'in_progress' || budget.estado === 'completed') && (
                     <Card className="bg-blue-50 border-blue-100">
                        <CardHeader className="pb-3">
                             <CardTitle className="text-base flex items-center gap-2 text-blue-800">
                                 <CreditCard className="h-4 w-4"/> Pagos
                            </CardTitle>
                        </CardHeader>
                         <CardContent>
                            <div className="text-2xl font-bold text-blue-700">
                                ${(budget.total - budget.saldoPendiente).toLocaleString()}
                            </div>
                            <div className="text-xs text-blue-600 mt-1">
                                Pendiente: ${budget.saldoPendiente.toLocaleString()}
                            </div>
                            <div className="mt-4">
                                <PaymentModal 
                                    tenantId={tenantId!} 
                                    budget={{ id: budget.id, saldoPendiente: budget.saldoPendiente, total: budget.total }}
                                    onSuccess={loadBudget}
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
