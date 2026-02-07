'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Pencil, Trash2, CheckCircle2, XCircle, Star, UserCircle2, PenTool } from 'lucide-react';
import { TemplatesService } from '@/lib/services/templates';
import { ProviderProfileService } from '@/lib/services/providerProfile';
import { TemplateSchema, TemplateValues, ProviderProfileSchema, ProviderProfileValues } from '@/lib/validation/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { SignaturePad, SignaturePadRef } from '@/components/ui/signature-pad';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function ConfigPage() {
    // --- TEMPLATES STATE ---
    const [templates, setTemplates] = useState<TemplateValues[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [currentTab, setCurrentTab] = useState("profile"); // Default to Profile for visibility now

    // --- PROFILE STATE ---
    const [profileLoading, setProfileLoading] = useState(false);
    const [hasSignature, setHasSignature] = useState(false);
    const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
    const sigPadRef = useRef<SignaturePadRef>(null);

    const form = useForm<TemplateValues>({
        resolver: zodResolver(TemplateSchema),
        defaultValues: {
            active: true,
            isDefault: false,
            title: '',
            content: '',
            type: 'clarifications'
        }
    });

    const profileForm = useForm<ProviderProfileValues>({
        resolver: zodResolver(ProviderProfileSchema),
        defaultValues: {
            fullName: '',
            email: '',
            phone: '',
            address: ''
        }
    });

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const data = await TemplatesService.listAll();
            setTemplates(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const loadProfile = async () => {
        setProfileLoading(true);
        try {
            const profile = await ProviderProfileService.getProfile();
            if (profile) {
                profileForm.reset({
                    fullName: profile.fullName || '',
                    email: profile.email || '',
                    phone: profile.phone || '',
                    address: profile.address || ''
                });
                if (profile.signature?.svg) {
                    setHasSignature(true);
                    setSignaturePreview(profile.signature.svg);
                } else {
                    setHasSignature(false);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setProfileLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
        loadProfile();
    }, []);

    const onTemplateSubmit = async (data: TemplateValues) => {
        try {
            if (editingId) {
                await TemplatesService.update(editingId, data);
            } else {
                await TemplatesService.create(data);
            }
            setIsDialogOpen(false);
            setEditingId(null);
            form.reset();
            loadTemplates();
        } catch (err) {
            console.error(err);
        }
    };

    const handleEdit = (tmpl: TemplateValues) => {
        setEditingId(tmpl.id!);
        form.reset(tmpl);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar plantilla?")) return;
        await TemplatesService.delete(id);
        loadTemplates();
    };

    const handleSetDefault = async (tmpl: TemplateValues) => {
        if (!tmpl.id || !tmpl.type) return;
        try {
            await TemplatesService.setDefaultTemplate(tmpl.id, tmpl.type);
            loadTemplates();
        } catch (e) { console.error(e); }
    };

    const handleToggleActive = async (tmpl: TemplateValues) => {
        if (!tmpl.id) return;
        await TemplatesService.toggleActive(tmpl.id, !tmpl.active);
        loadTemplates();
    };

    // --- PROFILE HANDLERS ---
    const onProfileSubmit = async (data: ProviderProfileValues) => {
        try {
            await ProviderProfileService.saveProfile(data);
            alert("Perfil guardado correctamente");
        } catch (e) {
            console.error(e);
            alert("Error al guardar perfil");
        }
    };

    const saveSignature = async () => {
        const svg = sigPadRef.current?.getSVG();
        if (!svg) {
            alert("Por favor firme primero");
            return;
        }
        try {
            await ProviderProfileService.saveSignature(svg);
            setHasSignature(true);
            setSignaturePreview(svg);
            sigPadRef.current?.clear();
            alert("Firma guardada");
        } catch (e) {
            console.error(e);
            alert("Error al guardar firma");
        }
    };

    const deleteSignature = async () => {
        if (!confirm("¿Borrar firma guardada?")) return;
        try {
            await ProviderProfileService.removeSignature();
            setHasSignature(false);
            setSignaturePreview(null);
            alert("Firma eliminada");
        } catch (e) {
            console.error(e);
        }
    };


    const filteredTemplates = templates.filter(t => t.type === currentTab);

    return (
        <div className="p-8 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Configuración</h1>
                {currentTab !== 'profile' && (
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={() => { setEditingId(null); form.reset({ active: true, isDefault: false, type: currentTab as any, title: '', content: '' }); }}>
                                <Plus className="mr-2 h-4 w-4" /> Nueva Plantilla
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{editingId ? "Editar Plantilla" : "Nueva Plantilla"}</DialogTitle>
                            </DialogHeader>
                            <form onSubmit={form.handleSubmit(onTemplateSubmit)} className="space-y-4 pt-4">
                                <div>
                                    <Label>Tipo</Label>
                                    <Select
                                        onValueChange={(val: any) => form.setValue('type', val)}
                                        defaultValue={form.getValues('type')}
                                        disabled={!!editingId}
                                    >
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="clarifications">Aclaraciones</SelectItem>
                                            <SelectItem value="conditions">Condiciones Generales</SelectItem>
                                            <SelectItem value="paymentConditions">Condiciones de Pago</SelectItem>
                                            <SelectItem value="paymentMethod">Método de Pago</SelectItem>
                                            <SelectItem value="notes">Notas Internas</SelectItem>
                                            <SelectItem value="internalNotes">Notas Internas (Presupuesto)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Título</Label>
                                    <Input {...form.register('title')} placeholder="Ej: Standard" />
                                    {form.formState.errors.title && <p className="text-red-500 text-xs">Requerido</p>}
                                </div>
                                <div>
                                    <Label>Contenido</Label>
                                    <Textarea {...form.register('content')} className="min-h-[100px]" />
                                    {form.formState.errors.content && <p className="text-red-500 text-xs">Requerido</p>}
                                </div>
                                <div className="flex items-center space-x-2">
                                    <input type="checkbox" {...form.register('active')} id="active" className="h-4 w-4" />
                                    <Label htmlFor="active">Activa</Label>
                                </div>
                                <Button type="submit" className="w-full">Guardar</Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <Tabs defaultValue="profile" value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className="mb-4 flex flex-wrap h-auto">
                    <TabsTrigger value="profile" className="font-bold"><UserCircle2 className="h-4 w-4 mr-2" /> Perfil del Prestador</TabsTrigger>
                    <TabsTrigger value="clarifications">Aclaraciones</TabsTrigger>
                    <TabsTrigger value="conditions">Condiciones</TabsTrigger>
                    <TabsTrigger value="paymentConditions">Cond. Pago</TabsTrigger>
                    <TabsTrigger value="paymentMethod">Mét. Pago</TabsTrigger>
                    <TabsTrigger value="notes">Notas Internas</TabsTrigger>
                    <TabsTrigger value="internalNotes">Notas Int. (Presup.)</TabsTrigger>
                </TabsList>

                {/* --- PROFILE CONTENT --- */}
                <TabsContent value="profile" className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        {/* LEFT: FORM INFO */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Datos del Prestador</CardTitle>
                                <CardDescription>Estos datos aparecerán en los presupuestos generados.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {profileLoading ? <Loader2 className="animate-spin" /> : (
                                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                                        <div>
                                            <Label>Nombre y Apellido / Razón Social <span className="text-red-500">*</span></Label>
                                            <Input {...profileForm.register('fullName')} />
                                            {profileForm.formState.errors.fullName && <p className="text-red-500 text-xs">Mínimo 3 caracteres</p>}
                                        </div>
                                        <div>
                                            <Label>Email <span className="text-red-500">*</span></Label>
                                            <Input {...profileForm.register('email')} />
                                            {profileForm.formState.errors.email && <p className="text-red-500 text-xs">Email inválido</p>}
                                        </div>
                                        <div>
                                            <Label>Teléfono</Label>
                                            <Input {...profileForm.register('phone')} />
                                        </div>
                                        <div>
                                            <Label>Dirección</Label>
                                            <Textarea {...profileForm.register('address')} />
                                        </div>
                                        <Button type="submit">Guardar Cambios</Button>
                                    </form>
                                )}
                            </CardContent>
                        </Card>

                        {/* RIGHT: SIGNATURE */}
                        <div className="space-y-6">
                            <Card>
                                <CardHeader>
                                    <div className="flex items-center gap-2">
                                        <PenTool className="h-5 w-5" />
                                        <CardTitle>Firma Digital</CardTitle>
                                    </div>
                                    <CardDescription>Dibuja tu firma para incluirla en los PDFs.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label className="mb-2 block">Nueva Firma</Label>
                                        <SignaturePad ref={sigPadRef} className="mb-3" />
                                        <Button onClick={saveSignature} size="sm" variant="default">Guardar Firma</Button>
                                    </div>

                                    <div className="border-t pt-4 mt-4">
                                        <Label className="mb-2 block">Firma Actual</Label>
                                        {hasSignature && signaturePreview ? (
                                            <div className="border border-slate-200 rounded p-4 bg-white relative group">
                                                <div dangerouslySetInnerHTML={{ __html: signaturePreview }} className="w-full h-32 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full" />
                                                <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={deleteSignature}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="h-32 border-2 border-dashed border-slate-200 rounded flex items-center justify-center bg-slate-50">
                                                <p className="text-slate-400 text-sm text-center px-4">
                                                    Sin firma cargada.<br />Esto no se mostrará en el PDF hasta que subas una.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- TEMPLATES CONTENT (Existing loop) --- */}
                {loading ? <Loader2 className="animate-spin mx-auto mt-8" /> : (
                    currentTab !== 'profile' && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {filteredTemplates.map(tmpl => (
                                <Card key={tmpl.id} className={!tmpl.active ? "opacity-60 border-dashed" : ""}>
                                    <CardHeader className="py-4 bg-slate-50 flex flex-row justify-between items-start rounded-t-lg">
                                        <div>
                                            <div className="font-semibold text-sm flex items-center gap-2">
                                                {tmpl.title}
                                                {tmpl.isDefault && <span className="flex items-center gap-1 bg-yellow-100 text-yellow-800 text-[10px] px-1.5 py-0.5 rounded border border-yellow-200"><Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> Default</span>}
                                                {!tmpl.active && <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded">Inactiva</span>}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="icon" variant="ghost" className="h-6 w-6 text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50"
                                                title="Hacer Default"
                                                onClick={() => handleSetDefault(tmpl)}
                                                disabled={!tmpl.active || tmpl.isDefault}
                                            >
                                                <Star className={`h-4 w-4 ${tmpl.isDefault ? "fill-current" : ""}`} />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleEdit(tmpl)}><Pencil className="h-3 w-3" /></Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => handleDelete(tmpl.id!)}><Trash2 className="h-3 w-3" /></Button>
                                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleToggleActive(tmpl)} title={tmpl.active ? "Desactivar" : "Activar"}>
                                                {tmpl.active ? <XCircle className="h-3 w-3 text-slate-400" /> : <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="pt-4 text-sm text-slate-600 whitespace-pre-wrap h-32 overflow-hidden text-ellipsis relative">
                                        {tmpl.content}
                                    </CardContent>
                                </Card>
                            ))}
                            {filteredTemplates.length === 0 && <div className="col-span-3 text-center py-10 text-slate-400 border-2 border-dashed rounded-lg">No hay plantillas de este tipo.</div>}
                        </div>
                    )
                )}
            </Tabs>
        </div>
    );
}
