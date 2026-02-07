'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registerPayment } from '@/lib/logic/budget-actions'; // Using the logic we built earlier
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const paymentSchema = z.object({
    monto: z.coerce.number().min(1, "Monto requerido"),
    metodo: z.enum(["efectivo", "transferencia", "cheque"]), // Fixed enum
    notas: z.string().optional()
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PaymentModalProps {
    tenantId: string;
    budget: { id: string, saldoPendiente: number, total: number };
    onSuccess: () => void;
    trigger?: React.ReactNode;
}

export function PaymentModal({ tenantId, budget, onSuccess, trigger }: PaymentModalProps) {
    const [open, setOpen] = useState(false);
    const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue } = useForm<PaymentFormValues>({
        resolver: zodResolver(paymentSchema) as any,
        defaultValues: { monto: budget.saldoPendiente }
    });

    const onSubmit = async (data: PaymentFormValues) => {
        try {
            await registerPayment(tenantId, budget.id, {
                monto: data.monto,
                metodo: data.metodo,
                notas: data.notas,
                fecha: Date.now()
            });
            setOpen(false);
            reset();
            onSuccess();
        } catch (error) {
            console.error(error);
            alert("Error al registrar pago");
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || <Button variant="outline">Registrar Pago</Button>}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Registrar Pago</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                    <div>
                        <label className="text-sm font-medium">Monto (Pendiente: ${budget.saldoPendiente})</label>
                        <Input
                            type="number"
                            step="0.01"
                            {...register('monto')}
                            max={budget.saldoPendiente} // Constraint validation
                        />
                        {errors.monto && <p className="text-red-500 text-xs">{errors.monto.message}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium">Método de Pago</label>
                        <Select onValueChange={(v) => setValue('metodo', v as any)}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="efectivo">Efectivo</SelectItem>
                                <SelectItem value="transferencia">Transferencia</SelectItem>
                                <SelectItem value="cheque">Cheque</SelectItem>
                            </SelectContent>
                        </Select>
                        {errors.metodo && <p className="text-red-500 text-xs">{errors.metodo.message}</p>}
                    </div>
                    <div>
                        <label className="text-sm font-medium">Notas / Referencia</label>
                        <Input {...register('notas')} placeholder="Nro Transferencia, etc." />
                    </div>
                    <Button type="submit" disabled={isSubmitting} className="w-full">
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Confirmar Pago"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
