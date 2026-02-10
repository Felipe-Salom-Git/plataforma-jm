'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/hooks/useTenant';
import { TrackingsService } from '@/lib/services/trackings';
import { SettingsService } from '@/lib/services/settings';
import { Tracking, TrackingTask, TrackingMaterial, DailyLog, Pago, ItemPresupuesto, Compra, PromesaPago, TrackingStatus, ChecklistItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Loader2, ArrowLeft, User, MapPin, Phone,
    Plus, DollarSign, Calendar, CheckSquare, Package, AlertTriangle, CheckCircle2, FileText, Trash2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { QuotePreviewModal } from '@/components/trackings/QuotePreviewModal';
import { TrackingExtras } from '@/components/trackings/TrackingExtras';
import { TrackingPurchases, TrackingPromises } from '@/components/trackings/TrackingModules';
import { TrackingPayments } from '@/components/trackings/TrackingPayments';
import { TrackingPlanning } from '@/components/trackings/TrackingPlanning';
import { TrackingTasks } from '@/components/trackings/TrackingTasks';

export default function TrackingDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { tenantId, isAuthenticated } = useTenant();

    const [tracking, setTracking] = useState<Tracking | null>(null);
    const [loading, setLoading] = useState(true);
    const [staff, setStaff] = useState<string[]>([]);

    // --- Data Loading ---
    useEffect(() => {
        if (tenantId && id) {
            loadTracking();
            loadStaff();
        }
    }, [tenantId, id]);

    const loadStaff = async () => {
        try {
            const s = await SettingsService.getSettings(tenantId!);
            setStaff(s.staff || []);
        } catch (e) {
            console.error("Error loading staff", e);
        }
    };

    const loadTracking = async () => {
        try {
            const data = await TrackingsService.getById(tenantId!, id as string);
            setTracking(data);
        } catch (error) {
            console.error(error);
            toast.error("Error cargando seguimiento");
        } finally {
            setLoading(false);
        }
    };

    // --- Handlers ---

    const handleStatusChange = async (newStatus: TrackingStatus) => {
        if (!tracking || !tenantId) return;
        await TrackingsService.updateStatus(tenantId, tracking.id, newStatus);
        setTracking({ ...tracking, status: newStatus });
        toast.success("Estado actualizado");
    };

    // Schedule
    const handleUpdateSchedule = async (newSchedule: Tracking['itemSchedule']) => {
        if (!tracking || !tenantId) return;
        await TrackingsService.updateItemSchedule(tenantId, tracking.id, newSchedule);
        setTracking({ ...tracking, itemSchedule: newSchedule });
        toast.success("Planificación actualizada");
    };

    // Tasks
    const handleUpdateTask = async (task: TrackingTask) => {
        if (!tracking || !tenantId) return;
        const newTasks = tracking.tasks.map(t => t.id === task.id ? task : t);
        setTracking({ ...tracking, tasks: newTasks });
        await TrackingsService.updateTasks(tenantId, tracking.id, newTasks);
    };

    const handleDeleteTask = async (taskId: string) => {
        if (!tracking || !tenantId) return;
        const newTasks = tracking.tasks.filter(t => t.id !== taskId);
        setTracking({ ...tracking, tasks: newTasks });
        await TrackingsService.updateTasks(tenantId, tracking.id, newTasks);
    };

    const handleAddTask = async (task: TrackingTask) => {
        if (!tracking || !tenantId) return;
        await TrackingsService.addTask(tenantId, tracking.id, task);
        setTracking({ ...tracking, tasks: [...tracking.tasks, task] });
        toast.success("Tarea agregada");
    };

    // Materials
    const updateMaterialStatus = async (matId: string, status: TrackingMaterial['status']) => {
        if (!tracking || !tenantId) return;
        const newMaterials = tracking.materials.map(m => m.id === matId ? { ...m, status } : m);
        setTracking({ ...tracking, materials: newMaterials });
        await TrackingsService.updateMaterials(tenantId, tracking.id, newMaterials);
    };

    // Logs
    const addLog = async (content: string) => {
        if (!tracking || !tenantId) return;
        const newLog: DailyLog = { id: `log_${Date.now()}`, date: Date.now(), content, author: "Usuario" };
        await TrackingsService.addLog(tenantId, tracking.id, newLog);
        setTracking({ ...tracking, dailyLogs: [...tracking.dailyLogs, newLog] });
        toast.success("Nota agregada");
    };

    // --- Modules ---

    const calculateFinancials = (currentExtras: ItemPresupuesto[]) => {
        if (!tracking) return { newTotal: 0, newSaldo: 0 };
        const extrasTotal = currentExtras.reduce((acc, i) => acc + i.total, 0);
        const originalTotal = tracking.quoteSnapshot.total;
        const newTotal = originalTotal + extrasTotal;
        const totalPaid = (tracking.pagos || []).reduce((acc, p) => acc + p.monto, 0);
        const newSaldo = newTotal - totalPaid;
        return { newTotal, newSaldo };
    };

    const handleAddExtra = async (item: ItemPresupuesto) => {
        if (!tracking || !tenantId) return;
        const newExtras = [...(tracking.extras || []), item];
        const { newTotal, newSaldo } = calculateFinancials(newExtras);

        await TrackingsService.updateExtras(tenantId, tracking.id, newExtras, newTotal, newSaldo);
        setTracking({ ...tracking, extras: newExtras, total: newTotal, saldoPendiente: newSaldo });
        toast.success("Extra agregado");
    };

    const handleEditExtra = async (item: ItemPresupuesto) => {
        if (!tracking || !tenantId) return;
        const newExtras = (tracking.extras || []).map(e => e.id === item.id ? item : e);
        const { newTotal, newSaldo } = calculateFinancials(newExtras);

        await TrackingsService.updateExtras(tenantId, tracking.id, newExtras, newTotal, newSaldo);
        setTracking({ ...tracking, extras: newExtras, total: newTotal, saldoPendiente: newSaldo });
        toast.success("Extra actualizado");
    };

    const handleRemoveExtra = async (item: ItemPresupuesto) => {
        if (!tracking || !tenantId) return;
        const newExtras = (tracking.extras || []).filter(e => e.id !== item.id);
        const { newTotal, newSaldo } = calculateFinancials(newExtras);

        await TrackingsService.updateExtras(tenantId, tracking.id, newExtras, newTotal, newSaldo);
        setTracking({ ...tracking, extras: newExtras, total: newTotal, saldoPendiente: newSaldo });
        toast.success("Extra eliminado");
    };

    const handleUpdateExtraStatus = async (item: ItemPresupuesto, status: 'planned' | 'bought' | 'used') => {
        if (!tracking || !tenantId) return;
        const newExtras = (tracking.extras || []).map(e => e.id === item.id ? { ...e, status } : e);
        // Financials don't change with status
        const { newTotal, newSaldo } = calculateFinancials(newExtras);

        await TrackingsService.updateExtras(tenantId, tracking.id, newExtras, newTotal, newSaldo);
        setTracking({ ...tracking, extras: newExtras, total: newTotal, saldoPendiente: newSaldo });
        toast.success("Estado de extra actualizado");
    };

    const handleUpdateExtra = async (item: ItemPresupuesto) => {
        if (!tracking || !tenantId) return;
        const newExtras = (tracking.extras || []).map(e => e.id === item.id ? item : e);
        // Financials only change if amount/price changes, which we calculate anyway
        const { newTotal, newSaldo } = calculateFinancials(newExtras);

        await TrackingsService.updateExtras(tenantId, tracking.id, newExtras, newTotal, newSaldo);
        setTracking({ ...tracking, extras: newExtras, total: newTotal, saldoPendiente: newSaldo });
    };

    const handleAddPurchase = async (p: Compra) => {
        if (!tracking || !tenantId) return;
        await TrackingsService.addPurchase(tenantId, tracking.id, p);
        setTracking({ ...tracking, purchases: [...(tracking.purchases || []), p] });
        toast.success("Compra registrada");
    };

    const handleRemovePurchase = async (p: Compra) => {
        if (!tracking || !tenantId) return;
        await TrackingsService.removePurchase(tenantId, tracking.id, p);
        setTracking({ ...tracking, purchases: (tracking.purchases || []).filter(x => x.id !== p.id) });
        toast.success("Compra eliminada");
    };

    const handleAddPromise = async (p: PromesaPago) => {
        if (!tracking || !tenantId) return;
        await TrackingsService.addPromise(tenantId, tracking.id, p);
        setTracking({ ...tracking, paymentPromises: [...(tracking.paymentPromises || []), p] });
        toast.success("Promesa agregada");
    };

    const handleRemovePromise = async (id: string) => {
        if (!tracking || !tenantId) return;
        const newPromises = (tracking.paymentPromises || []).filter(p => p.id !== id);
        await TrackingsService.updatePromises(tenantId, tracking.id, newPromises);
        setTracking({ ...tracking, paymentPromises: newPromises });
        toast.success("Promesa eliminada");
    };

    const handleMarkPromisePaid = async (p: PromesaPago) => {
        if (!tracking || !tenantId) return;

        // 1. Update Promise Status
        const newPromises = (tracking.paymentPromises || []).map(pr => pr.id === p.id ? { ...pr, estado: 'cumplida' as const } : pr);

        // 2. Register Payment automatically
        const payment: Pago = {
            id: `pay_${Date.now()}`,
            fecha: Date.now(),
            monto: p.monto,
            metodo: 'efectivo',
            notas: `Pago de promesa: ${p.nota || ''}`
        };

        const totalPaid = (tracking.pagos || []).reduce((acc, p) => acc + p.monto, 0) + p.monto;
        const newSaldo = tracking.total - totalPaid;

        try {
            await TrackingsService.updatePromises(tenantId, tracking.id, newPromises);
            await TrackingsService.registerPayment(tenantId, tracking.id, payment, newSaldo);

            setTracking({
                ...tracking,
                paymentPromises: newPromises,
                pagos: [...(tracking.pagos || []), payment],
                saldoPendiente: newSaldo
            });
            toast.success("Pago registrado y promesa cumplida");
        } catch (e) {
            toast.error("Error procesando pago");
        }
    };

    // Payments
    const registerPayment = async (pago: Pago) => {
        if (!tracking || !tenantId) return;
        const newTotalPaid = (tracking.pagos || []).reduce((acc, p) => acc + p.monto, 0) + pago.monto;
        const newSaldo = tracking.total - newTotalPaid;

        await TrackingsService.registerPayment(tenantId, tracking.id, pago, newSaldo);
        setTracking({
            ...tracking,
            pagos: [...(tracking.pagos || []), pago],
            saldoPendiente: newSaldo
        });
        toast.success("Pago registrado");
    };

    const deletePayment = async (id: string, monto: number) => {
        // TODO: Implement delete payment service properly if needed
        toast.error("Eliminar pago no implementado aún");
    }

    if (!isAuthenticated) return <div>Acceso denegado</div>;
    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (!tracking) return <div className="p-8">Seguimiento no encontrado</div>;

    // Derived Calc
    const totalOriginal = tracking.quoteSnapshot.total;
    const totalExtras = (tracking.extras || []).reduce((acc, i) => acc + i.total, 0);
    const totalActualizado = totalOriginal + totalExtras;
    const totalPaid = (tracking.pagos || []).reduce((acc, p) => acc + p.monto, 0);
    const totalPurchases = (tracking.purchases || []).reduce((acc, p) => acc + p.monto, 0);
    const margenEstimado = totalActualizado - totalPurchases;
    const margenReal = totalPaid - totalPurchases;
    const margenPercent = totalActualizado > 0 ? (margenEstimado / totalActualizado) * 100 : 0;

    // Unified list of execution items: Quote Items (Snapshot OR Legacy) + Extras (Tasks only)
    const rawQuoteItems = tracking.quoteSnapshot?.items || (tracking as any).items || [];
    const quoteItems = rawQuoteItems.map((i: any, idx: number) => ({
        ...i,
        uniqueId: i.id ? `item_${i.id}` : `quote_item_${idx}`,
        source: 'quote' as const
    }));
    const extraTaskItems = (tracking.extras || [])
        .filter(e => e.tipo === 'mano_obra')
        .map((e, idx) => ({
            ...e,
            uniqueId: e.id ? `extra_${e.id}` : `extra_task_${idx}`,
            source: 'extra' as const
        }));

    // Filter out subtasks that might have been saved as top-level tasks (orphan check)
    const cleanTasks = (tracking.tasks || []).filter(t => !t.id.startsWith('sub_'));

    const taskItems = cleanTasks.map((t, idx) => ({
        id: t.id,
        taskId: t.id,
        uniqueId: t.id ? `task_${t.id}` : `adhoc_task_${idx}`,
        descripcion: t.text,
        cantidad: 1,
        precioUnitario: 0,
        unidad: 'u',
        total: 0,
        completed: t.completed,
        assignee: t.assignee,
        subtasks: t.subtasks?.map(s => ({ ...s, completed: s.completed })),
        source: 'task' as const
    }));

    // For execution, we keep everything (TrackingTasks handles its own grouping)
    const unifiedItems = [...quoteItems, ...extraTaskItems];

    // For Planning, we include Quote Items (TASKS only), Extra Tasks, AND Ad-hoc Tasks.
    // Materials are excluded from Planning view as per user request.
    // Strictly filter for 'mano_obra' to avoid any ambiguous items appearing.
    const planningQuoteItems = quoteItems.filter(i => i.tipo === 'mano_obra');
    const unifiedPlanningItems = [...planningQuoteItems, ...extraTaskItems, ...taskItems];

    // Material Extras for display
    const extraMaterialItems = (tracking.extras || []).filter(e => e.tipo === 'material');

    return (
        <div className="container mx-auto py-8 px-4 max-w-7xl space-y-6">

            {/* Header / Summary */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="text-2xl font-bold">{tracking.title}</h1>
                        <Badge variant="outline">{tracking.quoteNumber}</Badge>
                    </div>
                    <p className="text-gray-500 ml-12">{tracking.clientSnapshot.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={tracking.status} onValueChange={(val: TrackingStatus) => handleStatusChange(val)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending_start">Pendiente</SelectItem>
                            <SelectItem value="in_progress">En Progreso</SelectItem>
                            <SelectItem value="waiting_client">Espera Cliente</SelectItem>
                            <SelectItem value="ready_to_deliver">Listo p/ Entregar</SelectItem>
                            <SelectItem value="delivered">Entr. / Finalizado</SelectItem>
                            <SelectItem value="closed">Cerrado Admin.</SelectItem>
                            <SelectItem value="canceled">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                    <QuotePreviewModal
                        quoteId={tracking.quoteId || tracking.presupuestoRef || ""}
                        quoteSnapshot={tracking.quoteSnapshot}
                    />
                </div>
            </div>

            {/* Financial Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <Card className="bg-slate-50">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-gray-500">Total Trabajo</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold">${totalActualizado.toLocaleString()}</div>
                        <p className="text-[10px] text-gray-400">Orig: {totalOriginal} + Ext: {totalExtras}</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-green-600">Cobrado</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-green-700">${totalPaid.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-red-50">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-red-600">Compras</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-red-700">${totalPurchases.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-100">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-orange-600">Saldo Pendiente</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0"><div className="text-xl font-bold text-orange-700">${tracking.saldoPendiente.toLocaleString()}</div></CardContent>
                </Card>
                <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-blue-600">Margen Est.</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold text-blue-700">${margenEstimado.toLocaleString()}</div>
                        <p className="text-xs text-blue-600">{margenPercent.toFixed(1)}%</p>
                    </CardContent>
                </Card>
                <Card className="bg-slate-100">
                    <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-gray-500">Checklist</CardTitle></CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl font-bold text-gray-700">
                            {tracking.checklist?.filter(c => c.completado).length || 0} / {tracking.checklist?.length || 0}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="tasks" className="w-full">
                <TabsList>
                    <TabsTrigger value="tasks">Ejecución y Tareas</TabsTrigger>
                    <TabsTrigger value="planning">Planificación</TabsTrigger>
                    <TabsTrigger value="financials">Finanzas (Extras/Pagos)</TabsTrigger>
                </TabsList>

                <TabsContent value="tasks" className="space-y-6 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            {/* Checklist */}
                            {/* Tasks */}
                            <TrackingTasks
                                tasks={cleanTasks}
                                items={unifiedItems}
                                staff={staff}
                                onAdd={handleAddTask}
                                onUpdate={handleUpdateTask}
                                onDelete={handleDeleteTask}
                                onUpdateExtra={handleUpdateExtra}
                            />

                            {/* Materials */}
                            <Card>
                                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Materiales (Originales)</CardTitle></CardHeader>
                                <CardContent>
                                    <div className="space-y-1">
                                        {(tracking.materials || []).map(mat => (
                                            <div key={mat.id} className="flex items-center justify-between p-2 border-b last:border-0 hover:bg-slate-50">
                                                <div>
                                                    <p className="font-medium text-sm">{mat.name}</p>
                                                    <p className="text-xs text-gray-500">{mat.quantity} {mat.unit}</p>
                                                </div>
                                                <Select value={mat.status} onValueChange={(v) => updateMaterialStatus(mat.id, v as TrackingMaterial['status'])}>
                                                    <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="planned">Planif.</SelectItem>
                                                        <SelectItem value="bought">Comprado</SelectItem>
                                                        <SelectItem value="used">Usado</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Extra Materials */}
                            {extraMaterialItems.length > 0 && (
                                <Card>
                                    <CardHeader className="pb-3 border-b bg-amber-50">
                                        <CardTitle className="text-base flex items-center gap-2 text-amber-900">
                                            <Package className="h-4 w-4" /> Materiales (Adicionales)
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-1 pt-2">
                                            {extraMaterialItems.map(mat => (
                                                <div key={mat.id} className="flex items-center justify-between p-2 border-b last:border-0 hover:bg-slate-50">
                                                    <div>
                                                        <p className="font-medium text-sm">{mat.descripcion}</p>
                                                        <p className="text-xs text-gray-500">{mat.cantidad} {mat.unidad}</p>
                                                    </div>
                                                    <Select
                                                        value={mat.status || 'planned'}
                                                        onValueChange={(v) => handleUpdateExtraStatus(mat, v as any)}
                                                    >
                                                        <SelectTrigger className="w-[110px] h-7 text-xs"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="planned">Planif.</SelectItem>
                                                            <SelectItem value="bought">Comprado</SelectItem>
                                                            <SelectItem value="used">Usado</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Right Column: Logs */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle>Bitácora</CardTitle>
                                    <AddLogModal onAdd={addLog} />
                                </CardHeader>
                                <CardContent>
                                    <div className="h-[400px] overflow-y-auto space-y-4">
                                        {(tracking.dailyLogs || []).sort((a, b) => b.date - a.date).map(log => (
                                            <div key={log.id} className="border-l-2 border-slate-300 pl-3 relative">
                                                <div className="text-[10px] text-gray-400 mb-0.5">{format(log.date, 'dd/MM HH:mm')}</div>
                                                <p className="text-sm text-gray-700">{log.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="planning" className="space-y-6 mt-4">
                    <TrackingPlanning
                        items={unifiedPlanningItems}
                        schedule={tracking.itemSchedule}
                        staff={staff}
                        onUpdateSchedule={handleUpdateSchedule}
                        onUpdateExtra={handleUpdateExtra}
                        onUpdateTask={handleUpdateTask}
                    />
                </TabsContent>

                <TabsContent value="financials" className="space-y-6 mt-4">
                    {/* Extras */}
                    <Card>
                        <CardHeader className="pb-3 border-b mb-3">
                            <CardTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> Extras y Adicionales</CardTitle>
                            <CardDescription>Ítems agregados fuera del presupuesto original</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <TrackingExtras
                                extras={tracking.extras || []}
                                onAdd={handleAddExtra}
                                onEdit={handleEditExtra}
                                onDelete={handleRemoveExtra}
                            />
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Payments */}
                        <Card>
                            <CardHeader className="pb-3 bg-green-50/50 border-b">
                                <CardTitle className="flex items-center gap-2 text-green-700">Pagos Ingresados</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <TrackingPayments
                                    pagos={tracking.pagos || []}
                                    onAdd={registerPayment}
                                    onDelete={deletePayment}
                                />
                            </CardContent>
                        </Card>

                        {/* Purchases */}
                        <Card>
                            <CardHeader className="pb-3 bg-red-50/50 border-b">
                                <CardTitle className="flex items-center gap-2 text-red-700">Compras y Gastos</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                                <TrackingPurchases
                                    purchases={tracking.purchases || []}
                                    onAdd={handleAddPurchase}
                                    onDelete={handleRemovePurchase}
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Promises */}
                    <Card>
                        <CardHeader className="pb-3 bg-orange-50/50 border-b">
                            <CardTitle className="flex items-center gap-2 text-orange-700">Promesas de Pago</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <TrackingPromises
                                promises={tracking.paymentPromises || []}
                                onAdd={handleAddPromise}
                                onMarkPaid={handleMarkPromisePaid}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div >
    );
}

// --- Sub-components (Modals) ---

function AddTaskModal({ onAdd }: { onAdd: (text: string, date?: number, priority?: 'low' | 'medium' | 'high') => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");
    const [date, setDate] = useState("");
    const [priority, setPriority] = useState<string>("medium");

    const submit = async () => {
        if (!text.trim()) return;

        await onAdd(
            text,
            date ? new Date(date).getTime() : undefined,
            priority as any
        );

        setText("");
        setDate("");
        setPriority("medium");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="ghost" size="sm"><Plus className="h-4 w-4" /></Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <Input value={text} onChange={e => setText(e.target.value)} placeholder="Describir tarea..." autoFocus />
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-xs text-gray-500 block mb-1">Fecha Planificada</label>
                            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="w-[120px]">
                            <label className="text-xs text-gray-500 block mb-1">Prioridad</label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Baja</SelectItem>
                                    <SelectItem value="medium">Media</SelectItem>
                                    <SelectItem value="high">Alta</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
                <DialogFooter><Button onClick={submit}>Agregar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddLogModal({ onAdd }: { onAdd: (text: string) => void }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState("");

    const submit = () => {
        if (!text.trim()) return;
        onAdd(text);
        setText("");
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button variant="ghost" size="sm"><Plus className="h-4 w-4" /></Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Nuevo Reporte Diario</DialogTitle></DialogHeader>
                <Textarea value={text} onChange={e => setText(e.target.value)} placeholder="¿Qué se hizo hoy?" className="min-h-[100px]" autoFocus />
                <DialogFooter><Button onClick={submit}>Guardar</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function AddPaymentModal({ saldoPendiente, onRegister }: { saldoPendiente: number, onRegister: (amount: number, method: Pago['metodo'], notes: string) => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(saldoPendiente);
    const [method, setMethod] = useState<Pago['metodo']>('efectivo');
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const submit = async () => {
        if (amount <= 0) return;
        setSubmitting(true);
        await onRegister(amount, method, notes);
        setSubmitting(false);
        setOpen(false);
        setAmount(0);
        setNotes("");
    };

    useEffect(() => {
        if (open) setAmount(saldoPendiente);
    }, [open, saldoPendiente]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="w-full bg-green-600 hover:bg-green-700"><DollarSign className="mr-2 h-4 w-4" /> Registrar Cobro</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Registrar Pago (Ingreso)</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm">Monto (Max: {saldoPendiente})</label>
                        <Input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-sm">Método</label>
                        <Select value={method} onValueChange={(v) => setMethod(v as Pago['metodo'])}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="efectivo">Efectivo</SelectItem>
                                <SelectItem value="transferencia">Transferencia</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <label className="text-sm">Notas</label>
                        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Comentarios..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={submit} disabled={submitting}>
                        {submitting ? <Loader2 className="animate-spin" /> : "Confirmar"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
