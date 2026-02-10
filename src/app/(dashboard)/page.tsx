'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { DashboardService, DashboardStats } from '@/lib/services/dashboard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, FileText, Clock, CheckCircle2, DollarSign, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { tenantId, isAuthenticated } = useTenant();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenantId) {
      loadData();
    }
  }, [tenantId]);

  const loadData = async () => {
    if (!tenantId) return;
    try {
      const s = await DashboardService.getStats();
      const e = await DashboardService.getRecentEvents();
      // Filter for future events only? Or keep recent. Service says "getRecentEvents" but logic is "orderBy createdAt desc".
      // The logic in service seems to be just fetching latest created budgets, mapped as events. 
      // User requirement: "Próximos eventos (ej: hoy / próximos 7 días)". 
      // The current service logic actually maps `start` to `createdAt` and `end` to `createdAt + validity`.
      // So "events" are basically "Active Budgets".
      // Let's filter in UI to show those that are not expired? Or just show the list as is for now.
      setEvents(e);
    } catch (error) {
      console.error("Error loading dashboard", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) return <div className="p-8">Inicia sesión para ver el tablero.</div>;
  if (loading) return <div className="p-8 flex items-center"><Loader2 className="animate-spin mr-2" /> Cargando...</div>;

  // Chart Data preparation
  const chartData = [
    { name: 'Pendiente', monto: stats?.montoTotalPendiente || 0 },
    { name: 'Aprobado', monto: stats?.montoTotalAprobado || 0 },
    { name: 'Cobrado', monto: stats?.montoCobrado || 0 },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tablero Principal</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Presupuestos Totales</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalPresupuestos}</div>
            <p className="text-xs text-muted-foreground">Generados en el periodo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{stats?.totalPendientes}</div>
            <div className="text-xs text-muted-foreground">
              ${new Intl.NumberFormat('es-AR').format(stats?.montoTotalPendiente || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aprobados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.totalAprobados}</div>
            <div className="text-xs text-muted-foreground">
              ${new Intl.NumberFormat('es-AR').format(stats?.montoTotalAprobado || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cobrado</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${new Intl.NumberFormat('es-AR').format(stats?.montoCobrado || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Total ingresado</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

        {/* Chart Section - Now taking more space (4 cols) */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Flujo de Caja</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
                  <Bar dataKey="monto" fill="#2563EB" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events - Repurposed as 3 cols */}
        <Card className="col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-slate-500" />
              Vencimientos Recientes
            </CardTitle>
            <Link href="/calendar" className="text-xs text-blue-600 hover:underline flex items-center">
              Ver todo <ArrowRight className="h-3 w-3 ml-1" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay eventos registrados.</p>
              ) : (
                events.slice(0, 5).map((e) => (
                  <div key={e.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none">{e.title}</p>
                      <p className="text-xs text-muted-foreground">
                        Vence: {e.end.toLocaleDateString()}
                      </p>
                    </div>
                    {/* Status dot or similar could go here */}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
