'use client';

import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect, useState } from 'react';
import { useTenant } from '@/lib/hooks/useTenant';
import { QuotesService } from '@/lib/services/quotes';
import { TemplatesService } from '@/lib/services/templates';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Save, Loader2, ArrowLeft, MoreHorizontal, FileText, LayoutTemplate } from 'lucide-react';
import { QuoteFormSchema, QuoteFormValues, TemplateValues } from '@/lib/validation/schemas';
import { toast } from 'sonner';

// --- PROPS ---
interface QuoteFormProps {
    initialData?: any;
    quoteId?: string;
}

export default function QuoteForm({ initialData, quoteId }: QuoteFormProps) {
    const { tenantId, isAuthenticated } = useTenant();
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [templates, setTemplates] = useState<TemplateValues[]>([]);
    const [validUntilManuallyEdited, setValidUntilManuallyEdited] = useState(false);

    // --- FORM INIT ---
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    // Map initialData to FormValues
    const defaultValues: Partial<QuoteFormValues> = initialData ? {
        title: initialData.titulo,
        date: initialData.date ? initialData.date : (initialData.createdAt ? formatDate(new Date(initialData.createdAt)) : formatDate(new Date())),
        validUntil: initialData.validUntil ? initialData.validUntil : (initialData.validezDias ? formatDate(new Date(Date.now() + initialData.validezDias * 86400000)) : undefined),
        status: initialData.estado || 'draft',
        client: {
            name: initialData.clienteSnapshot?.nombre || "",
            lines: initialData.clienteSnapshot?.direccion ? [initialData.clienteSnapshot.direccion] : [""],
            email: initialData.clienteSnapshot?.email || "",
            phone: initialData.clienteSnapshot?.telefono || ""
        },
        items: initialData.items?.map((i: any) => ({
            task: i.descripcion || i.task,
            quantity: i.cantidad || i.quantity,
            unitPrice: i.precioUnitario || i.unitPrice,
            total: i.total,
            // legacy mapping
            unit: i.unidad
        })) || [],
        materials: initialData.materials || [],
        descuentoGlobal: initialData.descuentoGlobal || 0,

        // Text fields
        clarifications: initialData.clarifications || initialData.observaciones || "",
        conditions: initialData.conditions || "",
        notes: initialData.notes || "",
        paymentConditions: initialData.paymentConditions || initialData.condicionesPago || "",
        paymentMethod: initialData.paymentMethod || "",
        internalNotesText: initialData.internalNotesText || ""
    } : {
        title: "",
        date: formatDate(new Date()),
        validUntil: formatDate(new Date(Date.now() + 15 * 86400000)),
        status: 'draft',
        client: { name: "", lines: [""], email: "", phone: "" },
        items: [{ task: '', quantity: 1, unitPrice: 0, total: 0 }],
        materials: [],
        descuentoGlobal: 0,
        clarifications: "",
        conditions: "",
        notes: "",
        paymentConditions: "",
        paymentMethod: "",
        internalNotesText: ""
    };

    const form = useForm<QuoteFormValues>({
        resolver: zodResolver(QuoteFormSchema) as any,
        defaultValues: defaultValues
    });

    // Watch date changes for auto-calculation
    const dateValue = useWatch({ control: form.control, name: "date" });
    const validUntilValue = useWatch({ control: form.control, name: "validUntil" });

    useEffect(() => {
        if (!validUntilManuallyEdited && dateValue) {
            const dateObj = new Date(dateValue);
            // Ensure we deal with local time or UTC as needed. 
            // Simple approach: append T00:00:00 to force local parsing if needed or just use standard Date
            if (!isNaN(dateObj.getTime())) {
                const newValidUntil = new Date(dateObj.getTime() + 15 * 86400000).toISOString().split('T')[0];
                if (form.getValues("validUntil") !== newValidUntil) {
                    form.setValue("validUntil", newValidUntil);
                }
            }
        }
    }, [dateValue, validUntilManuallyEdited, form]);

    // --- FIELD ARRAYS ---
    const itemsFieldArray = useFieldArray({
        control: form.control,
        name: "items"
    });

    const materialsFieldArray = useFieldArray({
        control: form.control,
        name: "materials"
    });

    // --- LOAD DATA ---
    useEffect(() => {
        if (tenantId) {
            loadTemplates();
        }
    }, [tenantId]);

    const loadTemplates = async () => {
        try {
            const temps = await TemplatesService.listAll();
            setTemplates(temps);
        } catch (error) {
            console.error("Error loading templates", error);
        }
    };

    // --- CALCULATIONS ---
    const items = useWatch({ control: form.control, name: "items" });
    const materials = useWatch({ control: form.control, name: "materials" });
    const descuentoGlobal = useWatch({ control: form.control, name: "descuentoGlobal" }) || 0;

    const calculateTotals = () => {
        const itemsTotal = items?.reduce((acc, item) => acc + (Math.round(Number(item.total)) || 0), 0) || 0;
        const materialsTotal = materials?.reduce((acc, mat) => acc + (Math.round(Number(mat.total)) || 0), 0) || 0;
        const subtotal = itemsTotal + materialsTotal;
        const total = subtotal - Math.round(Number(descuentoGlobal) || 0);
        return { subtotal, itemsTotal, materialsTotal, total: total > 0 ? total : 0 };
    };

    const { subtotal, total, itemsTotal, materialsTotal } = calculateTotals();

    // Auto-calc line totals effect
    // Note: In a real app, maybe do this onBlur or use simpler logic. 
    // Here we rely on user input or manual calc, but let's try to auto-update total if qty/price change?
    // Doing it correctly with RHF/UseWatch is tricky without causing loops.
    // For now, let's assume user inputs Unit Price and Quantity, and we update Total on Blur or Change if we built custom inputs.
    // Simplifying: we'll trust the input or add a small helper function.

    // --- ACTIONS ---
    const applyTemplate = (type: string, targetField: any) => {
        // Find selected template from a local state or just pick from list
        // Implementing simple "Select to Apply" in the UI section
    };

    const onSubmit = async (data: QuoteFormValues) => {
        if (!tenantId) return;
        setSubmitting(true);
        try {
            if (quoteId) {
                await QuotesService.updateQuote(quoteId, data);
            } else {
                const res = await QuotesService.createQuote(data);
                if (res.id) router.push(`/quotes/${res.id}`);
                return; // Redirecting
            }
            toast.success("Presupuesto guardado");
            router.refresh(); // Refresh if edit
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar");
        } finally {
            setSubmitting(false);
        }
    };

    if (!isAuthenticated) return <div className="p-8">Acceso denegado</div>;

    return (
        <form onSubmit={form.handleSubmit(onSubmit, (errors) => console.error("Validation errors:", errors))} className="min-h-screen bg-slate-50/50 pb-20">
            {/* STICKY HEADER */}
            <header className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" type="button" onClick={() => router.back()}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-900">
                            {quoteId ? `Editar Presupuesto` : 'Nuevo Presupuesto'}
                        </h1>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                            {quoteId ? 'Editando existente' : 'Creando borrador'}
                            {form.formState.isDirty && <Badge variant="secondary" className="text-[10px] h-4">Cambios sin guardar</Badge>}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" type="button" onClick={() => router.back()} className="bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900">
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={submitting}>
                        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Guardar Presupuesto
                    </Button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto p-6 space-y-8">

                {/* GENERAL INFO & CLIENT ROW */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="md:col-span-1 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <FileText className="h-4 w-4 text-slate-500" /> Información General
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Título de la Obra</label>
                                <Input {...form.register('title')} placeholder="Ej: Remodelación Cocina" className="font-medium bg-white text-slate-900 border-slate-200 placeholder:text-slate-400" />
                                {form.formState.errors.title && <p className="text-red-500 text-xs">{form.formState.errors.title.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Fecha</label>
                                    <Input
                                        type="date"
                                        {...form.register('date')}
                                        className="bg-white text-slate-900 border-slate-200"
                                    />
                                    {form.formState.errors.date && <p className="text-red-500 text-xs">{form.formState.errors.date.message}</p>}
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-medium text-slate-500">Válido hasta</label>
                                    <Input
                                        type="date"
                                        {...form.register('validUntil', {
                                            onChange: () => setValidUntilManuallyEdited(true)
                                        })}
                                        className="bg-white text-slate-900 border-slate-200"
                                    />
                                    {form.formState.errors.validUntil && <p className="text-red-500 text-xs">{form.formState.errors.validUntil.message}</p>}
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <label className="text-xs font-medium text-slate-500">Estado</label>
                                    <Select
                                        onValueChange={(val: any) => form.setValue('status', val)}
                                        defaultValue={form.getValues('status')}
                                    >
                                        <SelectTrigger className="bg-white text-slate-900 border-slate-200"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="draft">Borrador</SelectItem>
                                            <SelectItem value="pending">Pendiente</SelectItem>
                                            <SelectItem value="approved">Aprobado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-2 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold">Datos del Cliente</CardTitle>
                        </CardHeader>
                        <CardContent className="grid md:grid-cols-2 gap-4">
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium text-slate-500">Nombre / Razón Social</label>
                                <Input {...form.register('client.name')} placeholder="Nombre del cliente" className="bg-white text-slate-900 border-slate-200 placeholder:text-slate-400" />
                                {form.formState.errors.client?.name && <p className="text-red-500 text-xs">{form.formState.errors.client.name.message}</p>}
                            </div>
                            <div className="space-y-1 md:col-span-2">
                                <label className="text-xs font-medium text-slate-500">Dirección</label>
                                <Input {...form.register('client.lines.0')} placeholder="Dirección completa" className="bg-white text-slate-900 border-slate-200 placeholder:text-slate-400" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Email</label>
                                <Input {...form.register('client.email')} placeholder="cliente@email.com" className="bg-white text-slate-900 border-slate-200 placeholder:text-slate-400" />
                                {form.formState.errors.client?.email && <p className="text-red-500 text-xs">{form.formState.errors.client.email.message}</p>}
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-slate-500">Teléfono</label>
                                <Input {...form.register('client.phone')} placeholder="+56 9..." className="bg-white text-slate-900 border-slate-200 placeholder:text-slate-400" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* ITEMS SECTION */}
                <Card className="shadow-sm border-0 ring-1 ring-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 rounded-t-lg py-3">
                        <CardTitle className="text-base font-semibold">Ítems / Tareas</CardTitle>
                        <Button type="button" size="sm" onClick={() => itemsFieldArray.append({ task: '', quantity: 1, unitPrice: 0, total: 0 })}>
                            <Plus className="h-4 w-4 mr-2" /> Agregar Item
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">#</th>
                                        <th className="px-4 py-3">Descripción</th>
                                        <th className="px-4 py-3 w-24">Cantidad</th>
                                        <th className="px-4 py-3 w-32">Unitario</th>
                                        <th className="px-4 py-3 w-32">Total</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {itemsFieldArray.fields.map((field, index) => {
                                        // Helper to update line total
                                        const updateLineTotal = (idx: number) => {
                                            const qty = Math.round(form.getValues(`items.${idx}.quantity`) || 0);
                                            const price = Math.round(form.getValues(`items.${idx}.unitPrice`) || 0);
                                            form.setValue(`items.${idx}.total`, Math.round(qty * price));
                                        }

                                        return (
                                            <tr key={field.id} className="group hover:bg-slate-50/50">
                                                <td className="px-4 py-3 text-center text-muted-foreground">{index + 1}</td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        {...form.register(`items.${index}.task`)}
                                                        className="bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 px-2 h-8 font-medium focus-visible:ring-1 focus-visible:ring-slate-400"
                                                        placeholder="Descripción de la tarea..."
                                                    />
                                                    {form.formState.errors.items?.[index]?.task && <span className="text-red-500 text-[10px]">Requerido</span>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        type="number" step="1" min="0"
                                                        {...form.register(`items.${index}.quantity`, { valueAsNumber: true, onChange: () => updateLineTotal(index) })}
                                                        className="bg-white text-slate-900 border-slate-200 px-2 h-8 text-right focus-visible:ring-1 focus-visible:ring-slate-400"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        type="number" step="1" min="0"
                                                        {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true, onChange: () => updateLineTotal(index) })}
                                                        className="bg-white text-slate-900 border-slate-200 px-2 h-8 text-right focus-visible:ring-1 focus-visible:ring-slate-400"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                    <Input
                                                        readOnly
                                                        step="1"
                                                        {...form.register(`items.${index}.total`)}
                                                        className="border-0 bg-transparent focus-visible:ring-0 px-0 text-right tabular-nums pointer-events-none"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => itemsFieldArray.remove(index)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50/50 font-medium text-slate-700">
                                    <tr>
                                        <td colSpan={4} className="px-4 py-3 text-right">Subtotal Tareas:</td>
                                        <td className="px-4 py-3 text-right">${itemsTotal.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* MATERIALS SECTION */}
                <Card className="shadow-sm border-0 ring-1 ring-slate-200">
                    <CardHeader className="flex flex-row items-center justify-between bg-slate-50/50 rounded-t-lg py-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            Materiales <Badge variant="outline" className="text-[10px] font-normal bg-slate-100 text-slate-600 border-slate-200">Opcional</Badge>
                        </CardTitle>
                        <Button type="button" variant="secondary" size="sm" onClick={() => materialsFieldArray.append({ name: '', quantity: 1, unitPrice: 0, total: 0 })}>
                            <Plus className="h-4 w-4 mr-2" /> Agregar Material
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium border-b">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">#</th>
                                        <th className="px-4 py-3">Material</th>
                                        <th className="px-4 py-3 w-24">Unidad</th>
                                        <th className="px-4 py-3 w-24">Cant.</th>
                                        <th className="px-4 py-3 w-32">Precio</th>
                                        <th className="px-4 py-3 w-32">Total</th>
                                        <th className="px-4 py-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {materialsFieldArray.fields.map((field, index) => {
                                        const updateMatTotal = (idx: number) => {
                                            const qty = Math.round(form.getValues(`materials.${idx}.quantity`) || 0);
                                            const price = Math.round(form.getValues(`materials.${idx}.unitPrice`) || 0);
                                            form.setValue(`materials.${idx}.total`, Math.round(qty * price));
                                        }

                                        return (
                                            <tr key={field.id} className="group hover:bg-slate-50/50">
                                                <td className="px-4 py-3 text-center text-muted-foreground">{index + 1}</td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        {...form.register(`materials.${index}.name`)}
                                                        className="bg-white text-slate-900 border-slate-200 placeholder:text-slate-400 px-2 h-8 font-medium focus-visible:ring-1 focus-visible:ring-slate-400"
                                                        placeholder="Nombre material..."
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        {...form.register(`materials.${index}.unit`)}
                                                        className="bg-white text-slate-900 border-slate-200 px-2 h-8 focus-visible:ring-1 focus-visible:ring-slate-400"
                                                        placeholder="u"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        type="number" step="1" min="0"
                                                        {...form.register(`materials.${index}.quantity`, { valueAsNumber: true, onChange: () => updateMatTotal(index) })}
                                                        className="bg-white text-slate-900 border-slate-200 px-2 h-8 text-right focus-visible:ring-1 focus-visible:ring-slate-400"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        type="number" step="1" min="0"
                                                        {...form.register(`materials.${index}.unitPrice`, { valueAsNumber: true, onChange: () => updateMatTotal(index) })}
                                                        className="bg-white text-slate-900 border-slate-200 px-2 h-8 text-right focus-visible:ring-1 focus-visible:ring-slate-400"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-slate-700">
                                                    <Input
                                                        readOnly
                                                        {...form.register(`materials.${index}.total`)}
                                                        className="border-0 bg-transparent focus-visible:ring-0 px-0 text-right tabular-nums pointer-events-none"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => materialsFieldArray.remove(index)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {materialsFieldArray.fields.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-xs">
                                                No hay materiales agregados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50/50 font-medium text-slate-700">
                                    <tr>
                                        <td colSpan={5} className="px-4 py-3 text-right">Subtotal Materiales:</td>
                                        <td className="px-4 py-3 text-right">${materialsTotal.toLocaleString()}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* TEMPLATES & NOTES SECTION */}
                <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="pb-3"><CardTitle className="text-base">Textos y Condiciones</CardTitle></CardHeader>
                            <CardContent>
                                <Tabs defaultValue="payment" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 mb-4">
                                        <TabsTrigger value="payment">Pago</TabsTrigger>
                                        <TabsTrigger value="cond">Condiciones</TabsTrigger>
                                        <TabsTrigger value="notes">Notas</TabsTrigger>
                                    </TabsList>

                                    {/* Payment Helper */}
                                    <TabsContent value="payment" className="space-y-4">
                                        <TemplateField
                                            label="Condiciones de Pago"
                                            form={form} fieldName="paymentConditions"
                                            templates={templates.filter(t => t.type === 'paymentConditions')}
                                        />
                                        <TemplateField
                                            label="Método de Pago"
                                            form={form} fieldName="paymentMethod"
                                            templates={templates.filter(t => t.type === 'paymentMethod')}
                                        />
                                    </TabsContent>

                                    {/* Conditions Helper */}
                                    <TabsContent value="cond" className="space-y-4">
                                        <TemplateField
                                            label="Condiciones Generales"
                                            form={form} fieldName="conditions"
                                            templates={templates.filter(t => t.type === 'conditions')}
                                        />
                                        <TemplateField
                                            label="Aclaraciones"
                                            form={form} fieldName="clarifications"
                                            templates={templates.filter(t => t.type === 'clarifications')}
                                        />
                                    </TabsContent>

                                    {/* Notes Helper */}
                                    <TabsContent value="notes" className="space-y-4">
                                        <TemplateField
                                            label="Notas al Cliente"
                                            form={form} fieldName="notes"
                                            templates={templates.filter(t => t.type === 'notes')}
                                        />
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        <Card className="border-amber-100 bg-amber-50/30">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center justify-between">
                                    <span>Notas Internas</span>
                                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Privado</Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">Solo visible para el equipo.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <TemplateField
                                    label=""
                                    form={form} fieldName="internalNotesText"
                                    templates={templates.filter(t => t.type === 'internalNotes')}
                                    hideLabel
                                />
                            </CardContent>
                        </Card>
                    </div>

                    {/* TOTALS SUMMARY */}
                    <div>
                        <Card className="bg-slate-900 text-white sticky top-24 shadow-lg">
                            <CardHeader>
                                <CardTitle>Resumen Financiero</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between text-slate-300">
                                        <span>Subtotal Tareas</span>
                                        <span>${itemsTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-slate-300">
                                        <span>Subtotal Materiales</span>
                                        <span>${materialsTotal.toLocaleString()}</span>
                                    </div>
                                    <Separator className="bg-slate-700" />
                                    <div className="flex justify-between font-medium text-lg">
                                        <span>Subtotal General</span>
                                        <span>${subtotal.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Descuento Global ($)</label>
                                    <div className="flex gap-2">
                                        <Input
                                            type="number"
                                            step="1"
                                            min="0"
                                            className="bg-slate-800 border-slate-700 text-white focus-visible:ring-slate-500"
                                            {...form.register('descuentoGlobal', { valueAsNumber: true })}
                                        />
                                    </div>
                                </div>

                                <Separator className="bg-slate-700" />

                                <div className="pt-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-slate-400 text-sm">Total Final</span>
                                        <span className="text-3xl font-bold tracking-tight">${total.toLocaleString()}</span>
                                    </div>
                                    <p className="text-right text-xs text-slate-500">Impuestos incluidos si aplica</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

            </div>
        </form>
    );
}

// --- HELPER COMPONENT FOR TEMPLATES ---
function TemplateField({ label, form, fieldName, templates, hideLabel }: any) {
    const applyTemplate = (val: string) => {
        const t = templates.find((tmp: any) => tmp.id === val);
        if (t) {
            form.setValue(fieldName, t.content, { shouldDirty: true });
        }
    }

    return (
        <div className="space-y-2">
            {!hideLabel && <label className="text-xs font-medium text-slate-500">{label}</label>}
            <div className="space-y-2">
                {templates.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Select onValueChange={applyTemplate}>
                            <SelectTrigger className="h-8 text-xs w-full bg-white text-slate-900 border-slate-200 focus:ring-slate-400">
                                <SelectValue placeholder={`Cargar plantilla de ${label}...`} />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200">
                                {templates.map((t: any) => (
                                    <SelectItem
                                        key={t.id}
                                        value={t.id}
                                        className="text-slate-900 focus:bg-slate-100 focus:text-slate-900 cursor-pointer"
                                    >
                                        {t.title}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <Textarea
                    {...form.register(fieldName)}
                    className="min-h-[100px] text-sm resize-y bg-white text-slate-900 border-slate-200 placeholder:text-slate-400"
                    placeholder="Escribe aquí..."
                />
            </div>
        </div>
    )
}

