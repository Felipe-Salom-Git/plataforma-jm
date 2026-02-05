'use client';

import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { QuotesService } from '@/lib/services/quotes';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Save, Loader2 } from 'lucide-react';

// --- SCHEMA ---
const itemSchema = z.object({
  tipo: z.enum(['material', 'mano_obra']),
  descripcion: z.string().min(1, "Descripción requerida"),
  cantidad: z.coerce.number().min(0.01, "Mínimo 0.01"),
  unidad: z.string().min(1, "Unidad requerida"),
  precioUnitario: z.coerce.number().min(0, "Mínimo 0"),
  descuento: z.coerce.number().optional().default(0),
});

const formSchema = z.object({
  titulo: z.string().min(3, "Título requerido"),
  clienteNombre: z.string().min(1, "Nombre cliente requerido"),
  clienteDireccion: z.string().optional(),
  clienteEmail: z.string().email("Email inválido").optional().or(z.literal('')),
  validezDias: z.coerce.number().min(1).default(15),
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
  descuentoGlobal: z.coerce.number().optional().default(0),
});

type FormValues = z.infer<typeof formSchema>;

export default function BudgetForm() {
    const { tenantId, isAuthenticated } = useTenant();
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            validezDias: 15,
            items: [{ tipo: 'material', descripcion: '', cantidad: 1, unidad: 'u', precioUnitario: 0 }],
            descuentoGlobal: 0
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items"
    });

    // --- CALCULATIONS ---
    const items = useWatch({ control: form.control, name: "items" });
    const descuentoGlobal = useWatch({ control: form.control, name: "descuentoGlobal" }) || 0;

    const calculateTotals = () => {
        const subtotal = items.reduce((acc, item) => {
            const qty = Number(item.cantidad) || 0;
            const price = Number(item.precioUnitario) || 0;
            // Item discount could be implemented here logic-wise
            return acc + (qty * price);
        }, 0);

        const total = subtotal - descuentoGlobal;
        return { subtotal, total: total > 0 ? total : 0 };
    };

    const { subtotal, total } = calculateTotals();

    // --- SUBMIT ---
    const onSubmit = async (data: FormValues) => {
        if (!tenantId) return;
        setSubmitting(true);
        try {
            // Transform data to Presupuesto Interface
            const budgetData = {
                numero: 'AUTO', // Backend/Service should handle auto-increment or use ID
                titulo: data.titulo,
                clienteId: 'TEMP_ID', // Ideal: Select existing client or create new
                clienteSnapshot: {
                    nombre: data.clienteNombre,
                    direccion: data.clienteDireccion
                },
                items: data.items.map((item, idx) => ({
                    id: `item_${idx}`,
                    ...item,
                    total: item.cantidad * item.precioUnitario
                })),
                subtotal: subtotal,
                descuentoGlobal: data.descuentoGlobal,
                total: total,
                estado: 'draft',
                validezDias: data.validezDias,
                checklist: [], // Empty initially
                pagos: [],
                saldoPendiente: total
            };
            
            // @ts-ignore Types need full alignment but this captures the essence for the prototype
            const id = await QuotesService.create(tenantId, budgetData);
            
            router.push(`/presupuestos/${id}`); // Redirect to detail/PDF view
        } catch (error) {
            console.error("Error creating budget", error);
            alert("Error al guardar");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAuthenticated) return <div>Acceso denegado</div>;

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-5xl mx-auto p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Nuevo Presupuesto</h1>
                <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar Borrador
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Información General</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Título Obra</label>
                            <Input {...form.register('titulo')} placeholder="Ej: Instalación Eléctrica Casa X" />
                            {form.formState.errors.titulo && <p className="text-red-500 text-xs">{form.formState.errors.titulo.message}</p>}
                        </div>
                        <div>
                            <label className="text-sm font-medium">Validez (días)</label>
                            <Input type="number" {...form.register('validezDias')} />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Datos Cliente</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="text-sm font-medium">Nombre</label>
                            <Input {...form.register('clienteNombre')} placeholder="Juan Pérez" />
                            {form.formState.errors.clienteNombre && <p className="text-red-500 text-xs">{form.formState.errors.clienteNombre.message}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Dirección</label>
                                <Input {...form.register('clienteDireccion')} />
                            </div>
                            <div>
                                <label className="text-sm font-medium">Email</label>
                                <Input {...form.register('clienteEmail')} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Ítems</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ tipo: 'material', descripcion: '', quantity: 1, unit: 'u', price: 0 } as any)}>
                        <Plus className="h-4 w-4 mr-2" /> Agregar Ítem
                    </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                    {fields.map((field, index) => (
                        <div key={field.id} className="flex gap-4 items-start border-b pb-4 last:border-0 last:pb-0">
                             <div className="w-24">
                                <label className="text-xs text-muted-foreground">Tipo</label>
                                <Select 
                                    onValueChange={(val: any) => form.setValue(`items.${index}.tipo`, val)} 
                                    defaultValue={field.tipo}
                                >
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="material">Material</SelectItem>
                                        <SelectItem value="mano_obra">Mano Obra</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground">Descripción</label>
                                <Input {...form.register(`items.${index}.descripcion`)} placeholder="Descripción del ítem" />
                                {form.formState.errors.items?.[index]?.descripcion && <span className="text-red-500 text-xs">Requerido</span>}
                            </div>
                            <div className="w-20">
                                <label className="text-xs text-muted-foreground">Cant.</label>
                                <Input type="number" step="0.01" {...form.register(`items.${index}.cantidad`)} />
                            </div>
                            <div className="w-20">
                                <label className="text-xs text-muted-foreground">Unidad</label>
                                <Input {...form.register(`items.${index}.unidad`)} />
                            </div>
                            <div className="w-28">
                                <label className="text-xs text-muted-foreground">Unitario ($)</label>
                                <Input type="number" step="0.01" {...form.register(`items.${index}.precioUnitario`)} />
                            </div>
                            <div className="pt-6">
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card className="max-w-md ml-auto bg-slate-50">
                <CardContent className="p-6 space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-bold">${subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span>Descuento Global:</span>
                        <Input 
                            type="number" 
                            className="w-24 h-8 text-right" 
                            {...form.register('descuentoGlobal')} 
                        />
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between text-lg font-bold text-primary">
                        <span>Total Final:</span>
                        <span>${total.toLocaleString()}</span>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
