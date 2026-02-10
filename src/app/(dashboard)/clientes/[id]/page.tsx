"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTenant } from '@/lib/hooks/useTenant';
import { ClientsService } from '@/lib/services/clients';
import { TrackingsService } from '@/lib/services/trackings';
import type { Cliente, Tracking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Phone, Mail, MapPin, FileUser, Calendar, FileText, CheckCircle2, Clock, AlertCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';

export default function ClientDetailPage() {
    const { tenantId } = useTenant();
    const params = useParams();
    const router = useRouter();
    const clientId = params.id as string;

    const [client, setClient] = useState<Cliente | null>(null);
    const [trackings, setTrackings] = useState<Tracking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!tenantId || !clientId) return;

        const loadData = async () => {
            try {
                setLoading(true);
                const clientData = await ClientsService.getById(tenantId, clientId);
                if (!clientData) {
                    setError("Cliente no encontrado");
                    return;
                }
                setClient(clientData);

                const trackingsData = await TrackingsService.getByClient(tenantId, clientId);
                setTrackings(trackingsData);
            } catch (err) {
                console.error(err);
                setError("Error cargando datos del cliente");
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [tenantId, clientId]);

    // --- Delete Logic ---
    const [deleteTrackingId, setDeleteTrackingId] = useState<string | null>(null);
    const [deletingTracking, setDeletingTracking] = useState(false);

    const confirmDeleteTracking = async () => {
        if (!deleteTrackingId || !tenantId) return;
        setDeletingTracking(true);
        try {
            await TrackingsService.delete(tenantId, deleteTrackingId);
            setTrackings(trackings.filter(t => t.id !== deleteTrackingId));
            setDeleteTrackingId(null);
        } catch (error) {
            console.error(error);
            alert("No se pudo eliminar el seguimiento");
        } finally {
            setDeletingTracking(false);
        }
    };

    if (loading) return <div className="p-8">Cargando...</div>;
    if (error) return <div className="p-8 text-red-500">{error}</div>;
    if (!client) return <div className="p-8">Cliente no encontrado</div>;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{client.nombre}</h1>
                    <p className="text-muted-foreground flex items-center gap-2">
                        ID: {client.id}
                    </p>
                </div>
            </div>

            {/* Client Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Información de Contacto</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {client.email && (
                            <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-4 w-4 text-gray-500" />
                                <a href={`mailto:${client.email}`} className="hover:underline">{client.email}</a>
                            </div>
                        )}
                        {client.telefono && (
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-gray-500" />
                                <a href={`tel:${client.telefono}`} className="hover:underline">{client.telefono}</a>
                            </div>
                        )}
                        {client.direccion && (
                            <div className="flex items-center gap-2 text-sm">
                                <MapPin className="h-4 w-4 text-gray-500" />
                                <span>{client.direccion}</span>
                            </div>
                        )}
                        {client.cuit && (
                            <div className="flex items-center gap-2 text-sm">
                                <FileUser className="h-4 w-4 text-gray-500" />
                                <span>CUIT: {client.cuit}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Resumen</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span>Total Trabajos:</span>
                            <span className="font-medium">{trackings.length}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Activos:</span>
                            <span className="font-medium">
                                {trackings.filter(t => ['pending_start', 'in_progress'].includes(t.status)).length}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t">
                            <span>Último:</span>
                            <span className="font-medium text-xs text-right truncate max-w-[150px]">
                                {trackings[0]?.title || "-"}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Trackings List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Historial de Trabajos
                </h2>

                {trackings.length === 0 ? (
                    <Card className="p-8 text-center text-muted-foreground">
                        No hay trabajos registrados para este cliente.
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {trackings.map((tracking) => (
                            <Card
                                key={tracking.id}
                                className="cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => router.push(`/trackings/${tracking.id}`)}
                            >
                                <CardContent className="p-6">
                                    <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg">{tracking.title}</h3>
                                                <Badge variant="outline" className="text-xs">
                                                    #{tracking.quoteNumber}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-2">
                                                {/* Display Internal Notes if available, otherwise fallback or empty message */}
                                                {tracking.internalNotes || tracking.quoteSnapshot?.internalNotesText || "Sin notas internas"}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-6 text-sm">
                                            <div className="flex flex-col items-end gap-1">
                                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    <span>{format(tracking.createdAt, "d MMM yyyy", { locale: es })}</span>
                                                </div>
                                                <StatusBadge status={tracking.status} />
                                            </div>

                                            <div className="text-right min-w-[100px]">
                                                <div className="font-medium">
                                                    ${tracking.total?.toLocaleString()}
                                                </div>
                                                <div className={`text-xs ${tracking.saldoPendiente > 0 ? "text-amber-600" : "text-green-600"}`}>
                                                    {tracking.saldoPendiente > 0
                                                        ? `Resta: $${tracking.saldoPendiente.toLocaleString()}`
                                                        : "Pagado"
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Footer */}
                                    <div className="mt-4 pt-3 border-t border-border/50 flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setDeleteTrackingId(tracking.id);
                                            }}
                                        >
                                            <Trash2 className="mr-2 h-3 w-3" /> Eliminar Seguimiento
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={!!deleteTrackingId}
                onOpenChange={(open) => !open && setDeleteTrackingId(null)}
                onConfirm={confirmDeleteTracking}
                title="¿Eliminar seguimiento?"
                description="Esta acción eliminará el seguimiento y todo su historial permanentemente."
                loading={deletingTracking}
            />
        </div >
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles = {
        pending_start: { label: "Pendiente", color: "bg-amber-100 text-amber-800 hover:bg-amber-200", icon: Clock },
        in_progress: { label: "En Progreso", color: "bg-blue-100 text-blue-800 hover:bg-blue-200", icon: Clock },
        completed: { label: "Completado", color: "bg-green-100 text-green-800 hover:bg-green-200", icon: CheckCircle2 },
        canceled: { label: "Cancelado", color: "bg-destructive/10 text-destructive hover:bg-destructive/20", icon: AlertCircle },
    };

    const config = styles[status as keyof typeof styles] || styles.pending_start;
    const Icon = config.icon;

    return (
        <Badge className={`${config.color} border-0 flex items-center gap-1.5 font-medium`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    );
}
