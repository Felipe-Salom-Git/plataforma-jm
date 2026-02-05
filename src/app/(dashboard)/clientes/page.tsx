'use client';

import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { ClientsService } from '@/lib/services/clients';
import { Cliente } from '@/lib/types'; // Interfaces must be defined in types/index.ts
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Plus, Search, Phone, Mail, MapPin } from 'lucide-react';
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
                <div key={client.id} className="p-4 border rounded-lg bg-card hover:shadow-sm transition">
                    <h3 className="font-semibold text-lg">{client.nombre}</h3>
                    <div className="text-sm text-gray-500 mt-2 space-y-1">
                        {client.telefono && <div className="flex items-center gap-2"><Phone className="h-3 w-3"/> {client.telefono}</div>}
                        {client.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3"/> {client.email}</div>}
                        {client.direccion && <div className="flex items-center gap-2"><MapPin className="h-3 w-3"/> {client.direccion}</div>}
                    </div>
                </div>
            ))}
            {clients.length === 0 && <p className="text-gray-500 col-span-full text-center py-10">No hay clientes registrados.</p>}
        </div>
      )}
    </div>
  );
}
