'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { AdminService, AdminStats } from '@/lib/services/admin';
import { ExpensesService } from '@/lib/services/expenses';
import { Gasto } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Loader2,
    TrendingUp,
    TrendingDown,
    DollarSign,
    CreditCard,
    Wallet,
    Plus,
    Briefcase
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import { toast } from 'sonner';

export default function AdminPage() {
    const { tenantId, isAuthenticated } = useTenant();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [recentExpenses, setRecentExpenses] = useState<Gasto[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Expense Form
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [newExpense, setNewExpense] = useState({
        fecha: new Date().toISOString().split('T')[0],
        categoria: 'general',
        descripcion: '',
        monto: ''
    });

    useEffect(() => {
        if (tenantId) {
            loadData();
        }
    }, [tenantId, refreshTrigger]);

    const loadData = async () => {
        try {
            const [s, e] = await Promise.all([
                AdminService.getStats(),
                ExpensesService.listRecent(10)
            ]);
            setStats(s);
            setRecentExpenses(e);
        } catch (error) {
            console.error("Error loading admin data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async () => {
        if (!newExpense.descripcion || !newExpense.monto) {
            toast.error("Complete los campos obligatorios");
            return;
        }

        try {
            await ExpensesService.create({
                fecha: new Date(newExpense.fecha).getTime() + 12 * 60 * 60 * 1000, // Noon to avoid timezone issues
                categoria: newExpense.categoria,
                descripcion: newExpense.descripcion,
                monto: Number(newExpense.monto)
            });
            toast.success("Gasto registrado");
            setExpenseOpen(false);
            setNewExpense({
                fecha: new Date().toISOString().split('T')[0],
                categoria: 'general',
                descripcion: '',
                monto: ''
            });
            setRefreshTrigger(prev => prev + 1);
        } catch (error) {
            console.error(error);
            toast.error("Error al registrar gasto");
        }
    };

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
    };

    if (!isAuthenticated) return <div className="p-8">Acceso denegado</div>;
    if (loading) return <div className="p-8 flex items-center"><Loader2 className="animate-spin mr-2" /> Cargando panel administrativo...</div>;

    const monthlyProfitColor = (stats?.monthly.profit || 0) >= 0 ? "text-green-600" : "text-red-600";
    const dailyProfitColor = (stats?.daily.profit || 0) >= 0 ? "text-green-600" : "text-red-600";

    return (
        <div className="p-6 space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Administración</h1>
                    <p className="text-muted-foreground">Resumen financiero y gestión de gastos</p>
                </div>
                <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Nuevo Gasto</DialogTitle>
                            <DialogDescription>Registra un egreso para el cálculo de ganancias.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input
                                        type="date"
                                        value={newExpense.fecha}
                                        onChange={(e) => setNewExpense({ ...newExpense, fecha: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Monto</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                                        <Input
                                            type="number"
                                            className="pl-7"
                                            value={newExpense.monto}
                                            onChange={(e) => setNewExpense({ ...newExpense, monto: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Categoría</Label>
                                <Select
                                    value={newExpense.categoria}
                                    onValueChange={(val) => setNewExpense({ ...newExpense, categoria: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">General</SelectItem>
                                        <SelectItem value="materiales">Materiales</SelectItem>
                                        <SelectItem value="mano_obra">Mano de Obra</SelectItem>
                                        <SelectItem value="servicios">Servicios</SelectItem>
                                        <SelectItem value="impuestos">Impuestos</SelectItem>
                                        <SelectItem value="otros">Otros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Input
                                    placeholder="Ej: Compra de cables, Pago monotributo..."
                                    value={newExpense.descripcion}
                                    onChange={(e) => setNewExpense({ ...newExpense, descripcion: e.target.value })}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setExpenseOpen(false)}>Cancelar</Button>
                            <Button onClick={handleAddExpense}>Guardar Gasto</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* DAILY STATS */}
            <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <ClockIcon className="h-4 w-4" /> Hoy
                </h3>
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos (Hoy)</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatMoney(stats?.daily.income || 0)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Gastos (Hoy)</CardTitle>
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">-{formatMoney(stats?.daily.expenses || 0)}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ganancia Neta (Hoy)</CardTitle>
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${dailyProfitColor}`}>
                                {formatMoney(stats?.daily.profit || 0)}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* MONTHLY STATS */}
            <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" /> Este Mes
                </h3>
                <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ingresos Mensuales</CardTitle>
                            <TrendingUp className="h-4 w-4 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{formatMoney(stats?.monthly.income || 0)}</div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats?.monthly.prevIncome ? (
                                    <span className={stats.monthly.income > stats.monthly.prevIncome ? "text-green-600" : "text-red-500"}>
                                        {((stats.monthly.income - stats.monthly.prevIncome) / stats.monthly.prevIncome * 100).toFixed(1)}% vs mes anterior
                                    </span>
                                ) : "Sin datos mes anterior"}
                            </p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Gastos Mensuales</CardTitle>
                            <TrendingDown className="h-4 w-4 text-red-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-red-600">-{formatMoney(stats?.monthly.expenses || 0)}</div>
                        </CardContent>
                    </Card>
                    <Card className="col-span-2 md:col-span-2 bg-slate-50 border-slate-200">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ganancia Neta Mensual</CardTitle>
                            <Briefcase className="h-4 w-4 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-4xl font-bold ${monthlyProfitColor}`}>
                                {formatMoney(stats?.monthly.profit || 0)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">Margen operativo del periodo</p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* CHARTS */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Tendencia Mensual (6 Meses)</CardTitle>
                        <CardDescription>Ingresos vs Gastos</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats?.chartData || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(val: any) => formatMoney(val)} />
                                <Bar dataKey="ingresos" name="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="gastos" name="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Evolución Ganancia (30 Días)</CardTitle>
                        <CardDescription>Ganancia diaria neta</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats?.last30Days || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip formatter={(val: any) => formatMoney(val)} />
                                <Line type="monotone" dataKey="ganancia" name="Ganancia" stroke="#3b82f6" strokeWidth={2} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* EXPENSES LIST */}
            <Card>
                <CardHeader>
                    <CardTitle>Últimos Gastos Registrados</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Descripción</TableHead>
                                <TableHead>Categoría</TableHead>
                                <TableHead className="text-right">Monto</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recentExpenses.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No hay gastos registrados.</TableCell>
                                </TableRow>
                            ) : (
                                recentExpenses.map((expense) => (
                                    <TableRow key={expense.id}>
                                        <TableCell>{new Date(expense.fecha).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-medium">{expense.descripcion}</TableCell>
                                        <TableCell className="capitalize">{expense.categoria}</TableCell>
                                        <TableCell className="text-right text-red-600 font-medium">
                                            -{formatMoney(expense.monto)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function ClockIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}

function CalendarIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
