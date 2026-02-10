import { useState } from 'react';
import { Compra, PromesaPago } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Calendar, Check, AlertTriangle } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';

// --- PURCHASES COMPONENT ---

interface TrackingPurchasesProps {
    purchases: Compra[];
    onAdd: (p: Compra) => Promise<void>;
    onDelete: (p: Compra) => Promise<void>;
}

export function TrackingPurchases({ purchases, onAdd, onDelete }: TrackingPurchasesProps) {
    const [open, setOpen] = useState(false);
    const [newP, setNewP] = useState({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        proveedor: '',
        nota: ''
    });

    const handleAdd = async () => {
        await onAdd({
            id: `purch_${Date.now()}`,
            fecha: new Date(newP.fecha).getTime(),
            monto: parseFloat(newP.monto),
            proveedor: newP.proveedor,
            nota: newP.nota
        });
        setOpen(false);
        setNewP({ fecha: new Date().toISOString().split('T')[0], monto: '', proveedor: '', nota: '' });
    };

    const total = purchases.reduce((acc, p) => acc + p.monto, 0);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Registro de Compras (Egresos)</h3>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Registrar Compra</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Registrar Compra</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={newP.fecha} onChange={e => setNewP({ ...newP, fecha: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Monto</Label>
                                    <Input type="number" value={newP.monto} onChange={e => setNewP({ ...newP, monto: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <Input value={newP.proveedor} onChange={e => setNewP({ ...newP, proveedor: e.target.value })} placeholder="Ej: Corralón X" />
                            </div>
                            <div className="space-y-2">
                                <Label>Nota / Items</Label>
                                <Input value={newP.nota} onChange={e => setNewP({ ...newP, nota: e.target.value })} placeholder="Ej: 5 bolsas cemento" />
                            </div>
                        </div>
                        <DialogFooter><Button onClick={handleAdd}>Guardar</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Nota</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {purchases.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-4 text-muted-foreground text-xs">Sin compras registradas.</TableCell>
                            </TableRow>
                        ) : (
                            purchases.map(p => (
                                <TableRow key={p.id}>
                                    <TableCell className="text-xs text-gray-500">{new Date(p.fecha).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-xs font-medium">{p.proveedor}</TableCell>
                                    <TableCell className="text-xs text-gray-500 truncate max-w-[150px]">{p.nota}</TableCell>
                                    <TableCell className="text-right text-xs font-medium">${p.monto.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => onDelete(p)}>
                                            <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                        {purchases.length > 0 && (
                            <TableRow className="bg-slate-50">
                                <TableCell colSpan={3} className="text-right font-bold">Total Egresos:</TableCell>
                                <TableCell className="text-right font-bold text-red-600">-${total.toLocaleString()}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

// --- PROMISES COMPONENT ---

interface TrackingPromisesProps {
    promises: PromesaPago[];
    onAdd: (p: PromesaPago) => Promise<void>;
    onMarkPaid: (p: PromesaPago) => void;
}

export function TrackingPromises({ promises, onAdd, onMarkPaid }: TrackingPromisesProps) {
    const [open, setOpen] = useState(false);
    const [newP, setNewP] = useState({
        fecha: new Date().toISOString().split('T')[0],
        monto: '',
        nota: ''
    });

    const handleAdd = async () => {
        await onAdd({
            id: `prom_${Date.now()}`,
            fecha: new Date(newP.fecha).getTime(),
            monto: parseFloat(newP.monto),
            nota: newP.nota,
            estado: 'pendiente'
        });
        setOpen(false);
        setNewP({ fecha: new Date().toISOString().split('T')[0], monto: '', nota: '' });
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-sm">Promesas de Pago</h3>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" /> Agregar Promesa</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Nueva Promesa de Pago</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha Esperada</Label>
                                    <Input type="date" value={newP.fecha} onChange={e => setNewP({ ...newP, fecha: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Monto</Label>
                                    <Input type="number" value={newP.monto} onChange={e => setNewP({ ...newP, monto: e.target.value })} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Nota</Label>
                                <Input value={newP.nota} onChange={e => setNewP({ ...newP, nota: e.target.value })} placeholder="Ej: Cheque diferido..." />
                            </div>
                        </div>
                        <DialogFooter><Button onClick={handleAdd}>Guardar</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-3">
                {promises.length === 0 && <p className="text-xs text-gray-400 italic">No hay promesas activas.</p>}
                {promises.map(p => {
                    const isOverdue = p.estado === 'pendiente' && p.fecha < Date.now();
                    return (
                        <div key={p.id} className="flex items-center justify-between p-3 border rounded-md bg-white">
                            <div className="flex items-center gap-3">
                                {isOverdue && <AlertTriangle className="h-4 w-4 text-red-500" />}
                                <div>
                                    <p className="font-semibold text-sm">${p.monto.toLocaleString()}</p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Calendar className="h-3 w-3" /> {new Date(p.fecha).toLocaleDateString()}
                                    </div>
                                    {p.nota && <p className="text-xs text-gray-500 italic">{p.nota}</p>}
                                </div>
                            </div>
                            <div>
                                {p.estado === 'pendiente' ? (
                                    <Button size="sm" variant="ghost" className="text-blue-600 hover:text-blue-800" onClick={() => onMarkPaid(p)}>
                                        <Check className="h-4 w-4 mr-1" /> Cobrar
                                    </Button>
                                ) : (
                                    <Badge variant="secondary">Completada</Badge>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
