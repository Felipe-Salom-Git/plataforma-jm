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
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';

export default function PapeleraPage() {
    const { tenantId, isAuthenticated } = useTenant();
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [openEmptyConfirm, setOpenEmptyConfirm] = useState(false);
    const [emptying, setEmptying] = useState(false);

    const [deleteItem, setDeleteItem] = useState<{ id: string, type: 'quote' | 'client' | 'tracking', name: string } | null>(null);

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

    const handleEmptyTrash = async () => {
        if (!tenantId) return;
        setEmptying(true);
        try {
            // Fetch all IDs to delete
            const [qIds, cIds, tIds] = await Promise.all([
                QuotesService.getDeletedIds(),
                ClientsService.getDeletedIds(tenantId),
                TrackingsService.getDeletedIds(tenantId)
            ]);

            let count = 0;

            // Delete Quotes
            for (const id of qIds) {
                await QuotesService.deletePermanent(id);
                count++;
            }

            // Delete Clients
            for (const id of cIds) {
                await ClientsService.deletePermanent(tenantId, id);
                count++;
            }

            // Delete Trackings
            for (const id of tIds) {
                await TrackingsService.deletePermanent(tenantId, id);
                count++;
            }

            toast.success(`Papelera vaciada (${count} elementos eliminados)`);
            setOpenEmptyConfirm(false);
            loadData();
        } catch (error) {
            console.error("Error emptying trash", error);
            toast.error("Error al vaciar papelera");
        } finally {
            setEmptying(false);
        }
    };

    const confirmDeleteItem = async () => {
        if (!tenantId || !deleteItem) return;
        setEmptying(true); // Reuse emptying state for loading
        try {
            if (deleteItem.type === 'quote') await QuotesService.deletePermanent(deleteItem.id);
            if (deleteItem.type === 'client') await ClientsService.deletePermanent(tenantId, deleteItem.id);
            if (deleteItem.type === 'tracking') await TrackingsService.deletePermanent(tenantId, deleteItem.id);

            toast.success("Elemento eliminado permanentemente");
            setDeleteItem(null);
            loadData();
        } catch (error) {
            console.error("Error deleting item", error);
            toast.error("Error al eliminar elemento");
        } finally {
            setEmptying(false);
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
                    <Button
                        variant="destructive"
                        onClick={() => setOpenEmptyConfirm(true)}
                        disabled={loading || (quotes.length === 0 && clients.length === 0 && trackings.length === 0)}
                        className="ml-2 gap-2 text-white"
                    >
                        <Trash2 className="h-4 w-4" /> Vaciar Papelera
                    </Button>
                </div>
            </div>

            <ConfirmDialog
                open={openEmptyConfirm}
                onOpenChange={setOpenEmptyConfirm}
                title="¿Vaciar papelera?"
                description="Esto eliminará PERMANENTEMENTE todos los elementos de la papelera. Esta acción no se puede deshacer."
                onConfirm={handleEmptyTrash}
                loading={emptying}
            />

            <ConfirmDialog
                open={!!deleteItem}
                onOpenChange={(open) => !open && setDeleteItem(null)}
                title="¿Eliminar permanentemente?"
                description={`Estás a punto de eliminar "${deleteItem?.name}" de forma definitiva. Esta acción no se puede deshacer.`}
                onConfirm={confirmDeleteItem}
                loading={emptying}
            />

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
                        onDelete={(id: string, name: string) => setDeleteItem({ id, type: 'quote', name })}
                        loading={loading}
                    />
                </TabsContent>

                <TabsContent value="clients">
                    <DeletedTable
                        items={filterItems(clients)}
                        type="client"
                        icon={Users}
                        onRestore={(id: string) => handleRestore('client', id)}
                        onDelete={(id: string, name: string) => setDeleteItem({ id, type: 'client', name })}
                        loading={loading}
                    />
                </TabsContent>

                <TabsContent value="trackings">
                    <DeletedTable
                        items={filterItems(trackings)}
                        type="tracking"
                        icon={Activity}
                        onRestore={(id: string) => handleRestore('tracking', id)}
                        onDelete={(id: string, name: string) => setDeleteItem({ id, type: 'tracking', name })}
                        loading={loading}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function DeletedTable({ items, type, icon: Icon, onRestore, onDelete, loading }: any) {
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
                    {items.map((item: any) => {
                        const itemName = item.nombre || item.name || item.title || item.titulo || "Sin Nombre";
                        return (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span>{itemName}</span>
                                            <span className="text-xs text-muted-foreground font-normal">{item.id}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {item.deletedAt ? new Date(item.deletedAt).toLocaleString() : '-'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                                            onClick={() => onDelete(item.id, itemName)}
                                            title="Eliminar permanentemente"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200 h-8"
                                            onClick={() => onRestore(item.id)}
                                        >
                                            <RefreshCcw className="h-3 w-3 mr-2" /> Restaurar
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </Card>
    );
}
