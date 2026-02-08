'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { ClientsService } from '@/lib/services/clients';
import { Cliente } from '@/lib/types'; // Interfaces must be defined in types/index.ts
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Search, Phone, Mail, MapPin, Activity, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const clientSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  direccion: z.string().optional(),
  cuit: z.string().optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function ClientsPage() {
  const { tenantId, isAuthenticated } = useTenant();
  const [clients, setClients] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Form Hooks
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { nombre: '', telefono: '', email: '', direccion: '', cuit: '' }
  });

  useEffect(() => {
    if (tenantId) loadClients();
  }, [tenantId]);

  const loadClients = async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const data = await ClientsService.list(tenantId);
      setClients(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ClientFormValues) => {
    if (!tenantId) return;
    try {
      // @ts-ignore
      await ClientsService.create(tenantId, data);
      setOpen(false);
      form.reset();
      loadClients();
    } catch (e) {
      console.error(e);
      alert("Error al crear cliente");
    }
  };

  // --- Delete Logic ---
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteId || !tenantId) return;
    setDeleting(true);
    try {
      await ClientsService.delete(tenantId, deleteId);
      setDeleteId(null);
      await loadClients();
    } catch (error) {
      console.error(error);
      alert("No se pudo eliminar el cliente");
    } finally {
      setDeleting(false);
    }
  };

  if (!isAuthenticated) return <div>Acceso denegado</div>;

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Nuevo Cliente</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Cliente</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div>
                <Input {...form.register('nombre')} placeholder="Nombre Completo *" />
                {form.formState.errors.nombre && <p className="text-red-500 text-xs">{form.formState.errors.nombre.message}</p>}
              </div>
              <div>
                <Input {...form.register('telefono')} placeholder="Teléfono" />
              </div>
              <div>
                <Input {...form.register('email')} placeholder="Email" />
                {form.formState.errors.email && <p className="text-red-500 text-xs">{form.formState.errors.email.message}</p>}
              </div>
              <div>
                <Input {...form.register('direccion')} placeholder="Dirección" />
              </div>
              <div>
                <Input {...form.register('cuit')} placeholder="CUIT / DNI" />
              </div>
              <Button type="submit" disabled={form.formState.isSubmitting} className="w-full">
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : "Guardar Cliente"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
        <Input placeholder="Buscar cliente..." className="pl-8 max-w-sm" />
      </div>

      {loading ? <Loader2 className="animate-spin" /> : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {clients.map(client => (
            <Card key={client.id} className="relative group transition-all hover:shadow-md border-border/50">
              <Link href={`/clientes/${client.id}`} className="block h-full">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-semibold">{client.nombre}</CardTitle>
                    {client.activeTrackingId && (
                      <Badge variant="secondary" className="flex gap-1 items-center text-xs px-2 py-0.5 h-6">
                        <Activity className="h-3 w-3" />
                        Activo
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 pb-4">
                  {client.telefono && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {client.telefono}</div>}
                  {client.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {client.email}</div>}
                  {client.direccion && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {client.direccion}</div>}
                </CardContent>
              </Link>

              {/* Delete Button - Absolute positioned */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteId(client.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {clients.length === 0 && <p className="text-gray-500 col-span-full text-center py-10">No hay clientes registrados.</p>}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={confirmDelete}
        title="¿Eliminar cliente?"
        description="Esta acción eliminará al cliente permanentemente."
        loading={deleting}
      />
    </div>
  );
}
