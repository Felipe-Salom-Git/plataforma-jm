'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/hooks/useTenant';
import { TrackingsService } from '@/lib/services/trackings';
import { Tracking, TrackingTask, TrackingMaterial, DailyLog, Pago } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
    Loader2, ArrowLeft, Calendar, User, MapPin, Phone, Mail, 
    CheckCircle, Circle, Clock, Package, FileText, CreditCard, 
    Plus, Trash2, Save, DollarSign 
} from 'lucide-react';
import { toast } from 'sonner';

export default function TrackingDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const { tenantId, isAuthenticated } = useTenant();
    
    const [tracking, setTracking] = useState<Tracking | null>(null);
    const [loading, setLoading] = useState(true);

    // --- Data Loading ---
    useEffect(() => {
        if (tenantId && id) loadTracking();
    }, [tenantId, id]);

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

    // Status
    const updateStatus = async (newStatus: Tracking['status']) => {
        if (!tracking || !tenantId) return;
        try {
            await TrackingsService.update(tenantId, tracking.id, { status: newStatus });
            setTracking({ ...tracking, status: newStatus });
            toast.success("Estado actualizado");
        } catch (e) {
            toast.error("Error actualizando estado");
        }
    };

    // Schedule
    const updateSchedule = async (field: string, value: any) => {
        if (!tracking || !tenantId) return;
        const newSchedule = { ...tracking.schedule, [field]: value };
        try {
            await TrackingsService.update(tenantId, tracking.id, { schedule: newSchedule });
            setTracking({ ...tracking, schedule: newSchedule });
        } catch (e) {
            toast.error("Error actualizando agenda");
        }
    };

    // Tasks
    const toggleTask = async (taskId: string, current: boolean) => {
        if (!tracking || !tenantId) return;
        const newTasks = tracking.tasks.map(t => t.id === taskId ? { ...t, completed: !current } : t);
        setTracking({ ...tracking, tasks: newTasks }); // Optimistic
        try {
            await TrackingsService.updateTasks(tenantId, tracking.id, newTasks);
        } catch (e) {
            loadTracking(); // Revert
            toast.error("Error actualizando tarea");
        }
    };

    const addTask = async (text: string) => {
        if (!tracking || !tenantId) return;
        const newTask: TrackingTask = {
            id: `task_${Date.now()}`,
            text,
            completed: false
        };
        try {
            await TrackingsService.addTask(tenantId, tracking.id, newTask);
            setTracking({ ...tracking, tasks: [...tracking.tasks, newTask] });
            toast.success("Tarea agregada");
        } catch (e) {
            toast.error("Error agregando tarea");
        }
    };

    // Materials
    const updateMaterialStatus = async (matId: string, status: TrackingMaterial['status']) => {
        if (!tracking || !tenantId) return;
        const newMaterials = tracking.materials.map(m => m.id === matId ? { ...m, status } : m);
        setTracking({ ...tracking, materials: newMaterials });
        try {
            await TrackingsService.updateMaterials(tenantId, tracking.id, newMaterials);
        } catch (e) {
            loadTracking();
            toast.error("Error actualizando material");
        }
    };

    // Logs
    const addLog = async (content: string) => {
         if (!tracking || !tenantId) return;
         const newLog: DailyLog = {
             id: `log_${Date.now()}`,
             date: Date.now(),
             content,
             author: "Usuario" // TODO: Get real user name
         };
         try {
             await TrackingsService.addLog(tenantId, tracking.id, newLog);
             setTracking({ ...tracking, dailyLogs: [...tracking.dailyLogs, newLog] });
             toast.success("Entrada agregada");
         } catch (e) {
             toast.error("Error agregando entrada");
         }
    };

    // Payments
    const registerPayment = async (amount: number, method: Pago['metodo'], notes?: string) => {
        if (!tracking || !tenantId) return;
        const payment: Pago = {
            id: `pay_${Date.now()}`,
            monto: amount,
            fecha: Date.now(),
            metodo: method,
            notas: notes
        };
        const newTotalPaid = tracking.pagos.reduce((acc, p) => acc + p.monto, 0) + amount;
        
        try {
            await TrackingsService.registerPayment(tenantId, tracking.id, payment, newTotalPaid, tracking.total);
            setTracking({
                ...tracking,
                pagos: [...tracking.pagos, payment],
                saldoPendiente: tracking.total - newTotalPaid
            });
            toast.success("Pago registrado");
        } catch (e) {
            toast.error("Error registrando pago");
        }
    };

    if (!isAuthenticated) return <div>Acceso denegado</div>;
    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (!tracking) return <div className="p-8">Seguimiento no encontrado</div>;

    return (
        <div className="container mx-auto py-8 px-4 max-w-6xl space-y-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{tracking.title}</h1>
                            <Badge variant="outline" className={
                                tracking.status === 'completed' ? 'bg-green-100 text-green-800' :
                                tracking.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                'bg-slate-100 text-slate-800'
                            }>
                                {tracking.status === 'pending_start' ? 'Pendiente' :
                                 tracking.status === 'in_progress' ? 'En Progreso' :
                                 tracking.status === 'completed' ? 'Completado' : 'Cancelado'}
                            </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Cliente: {tracking.clientSnapshot.nombre} • Presupuesto #{tracking.quoteNumber}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <Select value={tracking.status} onValueChange={(v) => updateStatus(v as any)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Estado" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending_start">Pendiente</SelectItem>
                            <SelectItem value="in_progress">En Progreso</SelectItem>
                            <SelectItem value="completed">Completado</SelectItem>
                            <SelectItem value="canceled">Cancelado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column (Start/End, Tasks, Materials) */}
                <div className="md:col-span-2 space-y-6">
                    
                    {/* Client Info & Schedule */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Detalles y Planificación</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <p className="text-sm font-medium text-gray-500">Cliente</p>
                                    <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4"/> {tracking.clientSnapshot.nombre}</div>
                                    <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4"/> {tracking.clientSnapshot.telefono || '-'}</div>
                                    <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4"/> {tracking.clientSnapshot.direccion || '-'}</div>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-medium text-gray-500">Agenda</p>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Input 
                                                type="date" 
                                                value={tracking.schedule?.startDate ? new Date(tracking.schedule.startDate).toISOString().split('T')[0] : ''}
                                                onChange={(e) => updateSchedule('startDate', e.target.valueAsNumber)} // Note: valueAsNumber returns NaN for dates in some browsers, better parse
                                            />
                                        </div>
                                        <div className="w-24">
                                            <Input 
                                                type="time" 
                                                value={tracking.schedule?.startTime || ''}
                                                onChange={(e) => updateSchedule('startTime', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tasks */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Tareas</CardTitle>
                            <AddTaskModal onAdd={addTask} />
                        </CardHeader>
                        <CardContent>
                             <div className="space-y-2">
                                {(tracking.tasks || []).map(task => (
                                    <div key={task.id} className="flex items-start gap-3 p-2 bg-slate-50 rounded-md">
                                        <Checkbox 
                                            checked={task.completed} 
                                            onCheckedChange={() => toggleTask(task.id, task.completed)}
                                        />
                                        <div className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                            {task.text}
                                        </div>
                                    </div>
                                ))}
                                {(!tracking.tasks || tracking.tasks.length === 0) && <p className="text-sm text-gray-400 italic">No hay tareas.</p>}
                             </div>
                        </CardContent>
                    </Card>

                    {/* Materials */}
                    <Card>
                         <CardHeader>
                            <CardTitle>Materiales</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {(tracking.materials || []).map(mat => (
                                    <div key={mat.id} className="flex items-center justify-between p-2 border rounded-md">
                                        <div>
                                            <p className="font-medium text-sm">{mat.name}</p>
                                            <p className="text-xs text-gray-500">{mat.quantity} {mat.unit}</p>
                                        </div>
                                        <Select value={mat.status} onValueChange={(v) => updateMaterialStatus(mat.id, v as any)}>
                                            <SelectTrigger className="w-[130px] h-8 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="planned">Planificado</SelectItem>
                                                <SelectItem value="bought">Comprado</SelectItem>
                                                <SelectItem value="used">Utilizado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                                 {(!tracking.materials || tracking.materials.length === 0) && <p className="text-sm text-gray-400 italic">No hay materiales.</p>}
                            </div>
                        </CardContent>
                    </Card>

                </div>

                {/* Right Column (Logs, Finances) */}
                <div className="space-y-6">
                    
                    {/* Financials */}
                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader>
                            <CardTitle>Finanzas</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Total Presupuestado</span>
                                    <span className="font-medium">${tracking.total.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Pagado</span>
                                    <span className="font-medium text-green-600">${(tracking.total - tracking.saldoPendiente).toLocaleString()}</span>
                                </div>
                                <Separator />
                                <div className="flex justify-between items-center">
                                    <span className="font-semibold">Pendiente</span>
                                    <span className="font-bold text-xl">${tracking.saldoPendiente.toLocaleString()}</span>
                                </div>
                            </div>
                            
                            <AddPaymentModal saldoPendiente={tracking.saldoPendiente} onRegister={registerPayment} />

                            <div className="pt-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Historial de Pagos</p>
                                <div className="space-y-2">
                                    {(tracking.pagos || []).map(p => (
                                        <div key={p.id} className="bg-white p-2 rounded border text-xs flex justify-between">
                                            <div>
                                                <p className="font-bold">${p.monto.toLocaleString()}</p>
                                                <p className="text-gray-500">{new Date(p.fecha).toLocaleDateString()}</p>
                                            </div>
                                            <Badge variant="secondary" className="h-5">{p.metodo}</Badge>
                                        </div>
                                    ))}
                                    {(!tracking.pagos || tracking.pagos.length === 0) && <p className="text-xs text-gray-400">Sin pagos registrados.</p>}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Daily Logs */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Diario de Obra</CardTitle>
                            <AddLogModal onAdd={addLog} />
                        </CardHeader>
                        <CardContent>
                             <div className="relative border-l border-gray-200 ml-2 space-y-6 pt-2">
                                {(tracking.dailyLogs || []).sort((a,b) => b.date - a.date).map(log => (
                                    <div key={log.id} className="ml-4 relative">
                                        <div className="absolute -left-[21px] mt-1.5 h-2.5 w-2.5 rounded-full border border-white bg-gray-300"></div>
                                        <div className="text-xs text-gray-500 mb-1">{new Date(log.date).toLocaleString()}</div>
                                        <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">{log.content}</p>
                                    </div>
                                ))}
                                {(!tracking.dailyLogs || tracking.dailyLogs.length === 0) && <p className="text-gray-400 text-sm ml-4 italic">No hay entradas.</p>}
                            </div>
                        </CardContent>
                    </Card>

                </div>
            </div>
        </div>
    );
}

// --- Sub-components (Modals) ---

function AddTaskModal({ onAdd }: { onAdd: (text: string) => void }) {
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
                <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
                <Input value={text} onChange={e => setText(e.target.value)} placeholder="Describir tarea..." autoFocus />
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
            <DialogTrigger asChild><Button className="w-full"><DollarSign className="mr-2 h-4 w-4" /> Registrar Pago</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Registrar Pago</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm">Monto (Max: {saldoPendiente})</label>
                        <Input type="number" value={amount} onChange={e => setAmount(parseFloat(e.target.value))} />
                    </div>
                    <div>
                        <label className="text-sm">Método</label>
                        <Select value={method} onValueChange={(v) => setMethod(v as any)}>
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
