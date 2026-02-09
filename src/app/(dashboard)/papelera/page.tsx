'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCcw, Search, FileText, Users, Activity, Loader2 } from "lucide-react";
import { QuotesService } from '@/lib/services/quotes';
import { ClientsService } from '@/lib/services/clients';
import { TrackingsService } from '@/lib/services/trackings';
import { toast } from 'sonner';

export default function PapeleraPage() {
    const { tenantId, isAuthenticated } = useTenant();
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    
    // Data
    const [quotes, setQuotes] = useState<any[]>([]);
    const [clients, setClients] = useState<any[]>([]);
    const [trackings, setTrackings] = useState<any[]>([]);

    useEffect(() => {
        if (tenantId) loadData();
    }, [tenantId]);

    const loadData = async () => {
        if (!tenantId) return;
        setLoading(true);
        try {
            const [q, c, t] = await Promise.all([
                QuotesService.listDeleted(),
                ClientsService.listDeleted(tenantId),
                TrackingsService.listDeleted(tenantId)
            ]);
            setQuotes(q);
            setClients(c);
            setTrackings(t);
        } catch (error) {
            console.error("Error loading deleted items", error);
            toast.error("Error cargando papelera");
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (type: 'quote' | 'client' | 'tracking', id: string) => {
        if (!tenantId) return;
        try {
            if (type === 'quote') await QuotesService.restore(id);
            if (type === 'client') await ClientsService.restore(tenantId, id);
            if (type === 'tracking') await TrackingsService.restore(tenantId, id);
            
            toast.success("Elemento restaurado");
            loadData(); // Reload to refresh list
        } catch (error) {
            console.error("Error restoring item", error);
            toast.error("Error al restaurar");
        }
    };

    const filterItems = (items: any[]) => {
        if (!searchTerm) return items;
        const lower = searchTerm.toLowerCase();
        return items.filter(i => 
            (i.nombre || i.name || i.title || i.titulo || "").toLowerCase().includes(lower) ||
            (i.id || "").toLowerCase().includes(lower)
        );
    };

    if (!isAuthenticated) return <div className="p-8">Acceso denegado</div>;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-red-100 rounded-lg">
                        <Trash2 className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Papelera</h1>
                        <p className="text-muted-foreground">Gestión de elementos eliminados</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-full md:w-64">
                         <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar..." 
                            className="pl-8 bg-white" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" size="icon" onClick={loadData} disabled={loading}>
                        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="quotes" className="w-full">
                <TabsList className="grid w-full mb-4 md:w-[400px] grid-cols-3">
                    <TabsTrigger value="quotes">Presupuestos ({quotes.length})</TabsTrigger>
                    <TabsTrigger value="clients">Clientes ({clients.length})</TabsTrigger>
                    <TabsTrigger value="trackings">Trackings ({trackings.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="quotes">
                    <DeletedTable 
                        items={filterItems(quotes)} 
                        type="quote" 
                        icon={FileText} 
                        onRestore={(id: string) => handleRestore('quote', id)}
                        loading={loading}
                    />
                </TabsContent>

                <TabsContent value="clients">
                    <DeletedTable 
                        items={filterItems(clients)} 
                        type="client" 
                        icon={Users} 
                        onRestore={(id: string) => handleRestore('client', id)}
                        loading={loading}
                    />
                </TabsContent>

                <TabsContent value="trackings">
                    <DeletedTable 
                        items={filterItems(trackings)} 
                        type="tracking" 
                        icon={Activity} 
                        onRestore={(id: string) => handleRestore('tracking', id)}
                        loading={loading}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function DeletedTable({ items, type, icon: Icon, onRestore, loading }: any) {
    if (loading) {
        return <div className="p-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }

    if (items.length === 0) {
        return (
            <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-3">
                    <div className="bg-slate-100 p-4 rounded-full">
                        <Icon className="h-8 w-8 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-lg">No hay elementos</h3>
                        <p className="text-sm text-muted-foreground">
                            No se encontraron elementos eliminados en esta categoría.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Referencia / Nombre</TableHead>
                        <TableHead>Fecha Eliminado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item: any) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    <Icon className="h-4 w-4 text-muted-foreground" />
                                    <div className="flex flex-col">
                                        <span>{item.nombre || item.name || item.title || item.titulo || "Sin Nombre"}</span>
                                        <span className="text-xs text-muted-foreground font-normal">{item.id}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                                    onClick={() => onRestore(item.id)}
                                >
                                    <RefreshCcw className="h-3 w-3 mr-2" /> Restaurar
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}
