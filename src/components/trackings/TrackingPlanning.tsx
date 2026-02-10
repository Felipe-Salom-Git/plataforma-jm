import { useState } from 'react';
import { Tracking, ItemPresupuesto } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar as CalendarIcon, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface PlanningItem extends ItemPresupuesto {
    uniqueId: string; // The ID used for scheduling (e.g., 'item_0' or 'extra_123')
    source: 'quote' | 'extra' | 'task';
    taskId?: string; // For ad-hoc tasks
}

interface TrackingPlanningProps {
    items: PlanningItem[];
    schedule: Tracking['itemSchedule'];
    staff: string[];
    onUpdateSchedule: (schedule: Tracking['itemSchedule']) => Promise<void>;
    onUpdateExtra?: (item: ItemPresupuesto) => Promise<void>;
    onUpdateTask?: (task: any) => Promise<void>;
}

export function TrackingPlanning({ items, schedule, staff, onUpdateSchedule, onUpdateExtra, onUpdateTask }: TrackingPlanningProps) {
    const handleUpdateItem = async (itemId: string, data: Partial<{ date: number; startTime: string; endTime: string; assignee: string }>) => {
        const current = schedule?.[itemId] || { date: 0 };
        const updated = { ...current, ...data };

        const newSchedule = {
            ...(schedule || {}),
            [itemId]: updated
        };
        await onUpdateSchedule(newSchedule);
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Planificación de Items</h3>
            <p className="text-sm text-gray-500">Asigna fecha y horario a cada item del presupuesto y extras.</p>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                {items.map((item) => (
                    <PlanningItemCard
                        key={item.uniqueId}
                        item={item}
                        data={schedule?.[item.uniqueId]}
                        staff={staff}
                        onUpdateItem={(data) => handleUpdateItem(item.uniqueId, data)}
                        onUpdateExtra={onUpdateExtra}
                        onUpdateTask={onUpdateTask}
                    />
                ))}
            </div>
        </div>
    );
}

function PlanningItemCard({ item, data, staff, onUpdateItem, onUpdateExtra, onUpdateTask }: {
    item: PlanningItem;
    data: any;
    staff: string[];
    onUpdateItem: (data: any) => Promise<void>;
    onUpdateExtra?: (item: ItemPresupuesto) => Promise<void>;
    onUpdateTask?: (task: any) => Promise<void>;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const hasSubtasks = (item.subtasks?.length || 0) > 0;

    return (
        <Card className={cn("border-l-4", item.source === 'extra' ? "bg-amber-50 border-l-amber-500" : "bg-slate-50 border-l-blue-500")}>
            <CardContent className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm">{item.descripcion || (item as any).text}</p>
                            {item.source === 'task' && <span className="text-[10px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-full font-bold uppercase">Tarea General</span>}
                            {item.source === 'extra' && <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold uppercase">Extra</span>}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 items-center">
                        {/* Date Picker */}
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    size="sm"
                                    className={cn(
                                        "w-[180px] justify-start text-left font-normal",
                                        !data?.date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {data?.date ? format(data.date, "PPP", { locale: es }) : <span>Sin fecha</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={data?.date ? new Date(data.date) : undefined}
                                    onSelect={(d: Date | undefined) => onUpdateItem({ date: d ? d.getTime() : 0 })}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Time Inputs */}
                        <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-gray-400" />
                            <Input
                                type="time"
                                className="w-24 h-8 text-xs"
                                value={data?.startTime || ""}
                                onChange={e => onUpdateItem({ startTime: e.target.value })}
                            />
                            <span className="text-gray-400">-</span>
                            <Input
                                type="time"
                                className="w-24 h-8 text-xs"
                                value={data?.endTime || ""}
                                onChange={e => onUpdateItem({ endTime: e.target.value })}
                            />
                        </div>

                        {/* Staff Select */}
                        {item.source === 'extra' || item.source === 'task' ? (
                            <div className="flex flex-col gap-1 items-end">
                                <Select
                                    value={item.assignee || "unassigned"}
                                    onValueChange={async (val) => {
                                        if (item.source === 'extra' && onUpdateExtra) {
                                            const newExtra = { ...item };
                                            if (val === 'unassigned') delete newExtra.assignee;
                                            else newExtra.assignee = val;
                                            await onUpdateExtra(newExtra);
                                        }
                                        if (item.source === 'task' && onUpdateTask) {
                                            const taskUpdate = {
                                                id: item.taskId || item.id, // Ad-hoc tasks usually have id as task_timestamp
                                                completion: item.completed, // Preserve state if needed
                                                text: item.descripcion || (item as any).text,
                                                assignee: val === 'unassigned' ? undefined : val,
                                                relatedItemId: (item as any).relatedItemId,
                                                subtasks: item.subtasks,
                                                createdAt: (item as any).createdAt,
                                                completedAt: (item as any).completedAt
                                            };
                                            if (val === 'unassigned') delete taskUpdate.assignee;

                                            await onUpdateTask(taskUpdate);
                                        }
                                    }}
                                >
                                    <SelectTrigger className={cn("w-[180px] h-8 text-xs", item.source === 'extra' ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50")}>
                                        <User className={cn("h-3 w-3 mr-2", item.source === 'extra' ? "text-amber-700" : "text-slate-700")} />
                                        <SelectValue placeholder="Asignar a..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                                        {staff.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : (
                            <Select value={data?.assignee || ""} onValueChange={val => onUpdateItem({ assignee: val })}>
                                <SelectTrigger className="w-[180px] h-8 text-xs">
                                    <User className="h-3 w-3 mr-2" />
                                    <SelectValue placeholder="Asignar a..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                                    {staff.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                </div>

                {/* Subtasks Section for Extras */}
                {item.source === 'extra' && hasSubtasks && (
                    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3 border-t pt-2 border-amber-200/50">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-full flex justify-between px-0 hover:bg-amber-100/50">
                                <span className="text-xs text-amber-800 font-medium flex items-center gap-2">
                                    {item.subtasks?.length} Subtareas
                                    <span className="text-amber-600 font-normal">({item.subtasks?.filter(s => s.completed).length} completadas)</span>
                                </span>
                                {isOpen ? <ChevronDown className="h-3 w-3 text-amber-500" /> : <ChevronRight className="h-3 w-3 text-amber-500" />}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="space-y-1 mt-2 pl-2">
                                {item.subtasks?.map(sub => (
                                    <div key={sub.id} className="flex items-center justify-between text-xs group">
                                        <div className="flex items-center gap-2">
                                            <Checkbox checked={sub.completed} disabled className="h-3 w-3 opacity-70" />
                                            <span className={cn(sub.completed && "line-through text-gray-400")}>{sub.text}</span>
                                        </div>
                                        {sub.assignee && (
                                            <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 bg-amber-100 text-amber-800 border-amber-200">
                                                {sub.assignee}
                                            </Badge>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </CardContent>
        </Card>
    );
}
