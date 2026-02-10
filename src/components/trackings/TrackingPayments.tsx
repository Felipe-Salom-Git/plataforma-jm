import { useState } from 'react';
import { Pago } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TrackingPaymentsProps {
    pagos: Pago[];
    onAdd: (pago: Pago) => Promise<void>;
    onDelete: (id: string, monto: number) => Promise<void>;
}

export function TrackingPayments({ pagos, onAdd, onDelete }: TrackingPaymentsProps) {
    const [openForm, setOpenForm] = useState(false);
    const [newPago, setNewPago] = useState<Partial<Pago>>({
        monto: 0,
        metodo: 'efectivo',
        notas: ''
    });

    const handleAdd = async () => {
        if (!newPago.monto || newPago.monto <= 0) return;
        const p: Pago = {
            id: `pay_${Date.now()}`,
            fecha: Date.now(),
            monto: newPago.monto || 0,
            metodo: newPago.metodo as any || 'efectivo',
            notas: newPago.notas,
        };
        await onAdd(p);
        setNewPago({ monto: 0, metodo: 'efectivo', notas: '' });
        setOpenForm(false);
    };

    return (
        <div className="space-y-4">
            {!openForm ? (
                <Button variant="outline" className="w-full border-dashed" onClick={() => setOpenForm(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Registrar Cobro
                </Button>
            ) : (
                <div className="border p-4 rounded-md bg-green-50/30 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label>Monto</Label>
                            <Input
                                type="number"
                                value={newPago.monto}
                                onChange={e => setNewPago({ ...newPago, monto: parseFloat(e.target.value) })}
                            />
                        </div>
                        <div>
                            <Label>Método</Label>
                            <Select value={newPago.metodo} onValueChange={(v: any) => setNewPago({ ...newPago, metodo: v })}>
                                <SelectTrigger><SelectValue placeholder="Método" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="efectivo">Efectivo</SelectItem>
                                    <SelectItem value="transferencia">Transferencia</SelectItem>
                                    <SelectItem value="cheque">Cheque</SelectItem>
                                    <SelectItem value="otro">Otro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label>Nota</Label>
                        <Input value={newPago.notas} onChange={e => setNewPago({ ...newPago, notas: e.target.value })} placeholder="Detalle..." />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setOpenForm(false)}>Cancelar</Button>
                        <Button size="sm" onClick={handleAdd} className="bg-green-600 hover:bg-green-700">Guardar Pago</Button>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {pagos.map(p => (
                    <div key={p.id} className="flex justify-between items-center p-3 border rounded-md bg-white hover:bg-slate-50">
                        <div>
                            <p className="font-bold text-green-700">+ ${p.monto.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">{format(p.fecha, 'dd/MM/yyyy', { locale: es })} • {p.metodo} {p.notas ? `• ${p.notas}` : ''}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-500" onClick={() => onDelete(p.id, p.monto)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
