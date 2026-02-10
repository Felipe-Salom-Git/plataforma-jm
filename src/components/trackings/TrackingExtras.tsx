import { useState } from 'react';
import { ItemPresupuesto, ExtraTemplate } from '@/lib/types';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TrackingExtrasProps {
    extras: ItemPresupuesto[];
    onAdd: (item: ItemPresupuesto) => Promise<void>;
    onEdit: (item: ItemPresupuesto) => Promise<void>;
    onDelete: (item: ItemPresupuesto) => Promise<void>;
}

export function TrackingExtras({ extras, onAdd, onEdit, onDelete }: TrackingExtrasProps) {
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState<{
        descripcion: string;
        cantidad: string | number;
        unidad: string;
        precioUnitario: string | number;
        tipo: 'material' | 'mano_obra';
    }>({
        descripcion: '',
        cantidad: 1,
        unidad: 'u',
        precioUnitario: 0,
        tipo: 'material',
    });

    const handleSave = async () => {
        const item: ItemPresupuesto = {
            id: editingId || `extra_${Date.now()}`,
            tipo: newItem.tipo,
            descripcion: newItem.descripcion,
            cantidad: Number(newItem.cantidad),
            unidad: newItem.unidad as any,
            precioUnitario: Number(newItem.precioUnitario),
            total: Number(newItem.cantidad) * Number(newItem.precioUnitario)
        };

        if (editingId) {
            await onEdit(item);
        } else {
            await onAdd(item);
        }

        setOpen(false);
        resetForm();
    }

    const resetForm = () => {
        setNewItem({ descripcion: '', cantidad: 1, unidad: 'u', precioUnitario: 0, tipo: 'material' });
        setEditingId(null);
    };

    const handleEditClick = (item: ItemPresupuesto) => {
        setNewItem({
            descripcion: item.descripcion,
            cantidad: item.cantidad,
            unidad: item.unidad,
            precioUnitario: item.precioUnitario,
            tipo: item.tipo === 'mano_obra' ? 'mano_obra' : 'material'
        });
        setEditingId(item.id);
        setOpen(true);
    };

    const handleSelectTemplate = (t: ExtraTemplate) => {
        setNewItem({
            descripcion: t.name,
            cantidad: 1,
            unidad: t.unit || 'u',
            precioUnitario: t.price || 0,
            tipo: 'material' // Default to material regarding template
        });
        setEditingId(null);
        setOpen(true);
    };

    const totalExtras = extras.reduce((acc, item) => acc + item.total, 0);

    return (
        <div className="space-y-4 pb-24 md:pb-0">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Extras y Adicionales</h3>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="hidden md:flex">
                        <Plus className="h-4 w-4 mr-2" /> Agregar Extra
                    </Button>
                </div>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Tipo</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead className="w-[80px]">Cant.</TableHead>
                            <TableHead className="w-[80px]">Uni.</TableHead>
                            <TableHead className="w-[100px] text-right">Precio</TableHead>
                            <TableHead className="w-[100px] text-right">Total</TableHead>
                            <TableHead className="w-[80px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {extras.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-4 text-muted-foreground text-xs">Sin extras registrados.</TableCell>
                            </TableRow>
                        ) : (
                            extras.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Badge variant={item.tipo === 'mano_obra' ? "default" : "secondary"} className="text-[10px]">
                                            {item.tipo === 'mano_obra' ? 'Tarea' : 'Material'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-xs cursor-pointer hover:underline" onClick={() => handleEditClick(item)}>{item.descripcion}</TableCell>
                                    <TableCell className="text-right text-xs">{item.cantidad} {item.unidad}</TableCell>
                                    <TableCell className="text-right text-xs">${item.precioUnitario?.toLocaleString()}</TableCell>
                                    <TableCell className="text-right font-bold text-xs">${item.total?.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(item)}>
                                                <FileText className="h-3 w-3 text-blue-500" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => onDelete(item)}>
                                                <Trash2 className="h-3 w-3 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                        {extras.length > 0 && (
                            <TableRow className="bg-slate-50">
                                <TableCell colSpan={5} className="text-right font-bold">Total Extras:</TableCell>
                                <TableCell className="text-right font-bold">${totalExtras.toLocaleString()}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Bottom Action Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-50">
                <Button className="w-full shadow-lg" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar Extra
                </Button>
            </div>

            <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) resetForm(); }}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{editingId ? 'Editar Extra' : 'Agregar Extra'}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <Select value={newItem.tipo} onValueChange={(val: any) => setNewItem({ ...newItem, tipo: val })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="material">Material</SelectItem>
                                    <SelectItem value="mano_obra">Tarea / Mano de Obra</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Input value={newItem.descripcion} onChange={e => setNewItem({ ...newItem, descripcion: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Cant.</Label>
                                <Input type="number" value={newItem.cantidad} onChange={e => setNewItem({ ...newItem, cantidad: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Unidad</Label>
                                <Input value={newItem.unidad} onChange={e => setNewItem({ ...newItem, unidad: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Precio Unit.</Label>
                                <Input type="number" value={newItem.precioUnitario} onChange={e => setNewItem({ ...newItem, precioUnitario: e.target.value })} />
                            </div>
                        </div>
                        <div className="text-right font-bold">
                            Total: ${(Number(newItem.cantidad) * Number(newItem.precioUnitario)).toLocaleString()}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave}>{editingId ? 'Guardar Cambios' : 'Agregar'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
