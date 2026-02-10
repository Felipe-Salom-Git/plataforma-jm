'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { DashboardService } from '@/lib/services/dashboard';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const locales = {
    'es': es,
};
const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

export default function CalendarPage() {
    const { tenantId, isAuthenticated } = useTenant();
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (tenantId) {
            loadEvents();
        }
    }, [tenantId]);

    const loadEvents = async () => {
        try {
            const e = await DashboardService.getRecentEvents();
            setEvents(e);
        } catch (error) {
            console.error("Error loading calendar events", error);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) return <div className="p-8">Inicia sesión para ver el calendario.</div>;
    if (loading) return <div className="p-8 flex items-center"><Loader2 className="animate-spin mr-2" /> Cargando calendario...</div>;

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Calendario de Vencimientos</h1>
            <Card>
                <CardContent className="p-0">
                    <div className="h-[calc(100vh-200px)] p-4">
                        <Calendar
                            localizer={localizer}
                            events={events}
                            startAccessor="start"
                            endAccessor="end"
                            culture='es'
                            messages={{
                                next: "Sig",
                                previous: "Ant",
                                today: "Hoy",
                                month: "Mes",
                                week: "Semana",
                                day: "Día"
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
