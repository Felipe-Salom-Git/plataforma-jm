import { useState } from 'react';
import { TrackingTask, ItemPresupuesto } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, ChevronDown, ChevronRight, CheckCircle2, User } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface TrackingTasksProps {
    tasks: TrackingTask[];
    items: (ItemPresupuesto & { uniqueId?: string; source?: 'quote' | 'extra' })[];
    staff: string[];
    onAdd: (task: TrackingTask) => Promise<void>;
    onUpdate: (task: TrackingTask) => Promise<void>;
    onDelete: (taskId: string) => Promise<void>;
    onUpdateExtra?: (item: ItemPresupuesto) => Promise<void>;
}

export function TrackingTasks({ tasks, items, staff, onAdd, onUpdate, onDelete, onUpdateExtra }: TrackingTasksProps) {
    const [openAdd, setOpenAdd] = useState(false);
    const [newTask, setNewTask] = useState<{ text: string; relatedItemId: string; assignee: string }>({ text: '', relatedItemId: 'general', assignee: '' });

    const handleAdd = async () => {
        if (!newTask.text.trim()) return;
        const task: TrackingTask = {
            id: `task_${Date.now()}`,
            text: newTask.text,
            completed: false,
            createdAt: Date.now(),
            relatedItemId: newTask.relatedItemId === 'general' ? undefined : newTask.relatedItemId,
            assignee: newTask.assignee || undefined,
            subtasks: []
        };
        await onAdd(task);
        setOpenAdd(false);
        setNewTask({ text: '', relatedItemId: 'general', assignee: '' });
    };

    // Group tasks
    const tasksByItem: Record<string, TrackingTask[]> = { 'general': [] };
    // Initialize groups for all items
    items.forEach((item, idx) => {
        const key = item.uniqueId || `item_${idx}`;
        tasksByItem[key] = [];
    });

    tasks.forEach(t => {
        const key = t.relatedItemId || 'general';
        if (!tasksByItem[key]) tasksByItem[key] = [];
        tasksByItem[key].push(t);
    });

    return (
        <div className="space-y-6 pb-24 md:pb-0">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Tareas y Ejecución</h3>
                {/* Desktop Button */}
                <Button onClick={() => setOpenAdd(true)} className="hidden md:flex">
                    <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
                </Button>
            </div>

            {/* General Tasks */}
            <TaskGroup
                title="Tareas Generales"
                tasks={tasksByItem['general']}
                staff={staff}
                onUpdate={onUpdate}
                onDelete={onDelete}
            />

            {/* Extra Tasks (Items from Extras) */}
            {items.filter(i => i.source === 'extra').length > 0 && (
                <Card>
                    <CardHeader className="py-3 bg-amber-50 border-b">
                        <CardTitle className="text-sm font-medium flex justify-between items-center text-amber-900">
                            Tareas Adicionales (Extras)
                            <Badge variant="outline" className="text-xs font-normal bg-amber-100 text-amber-900 border-amber-200">
                                {items.filter(i => i.source === 'extra').length}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {items.filter(i => i.source === 'extra').map((item, idx) => (
                            <ExtraTaskItem
                                key={item.id || idx}
                                item={item}
                                staff={staff}
                                onUpdate={onUpdateExtra}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Item Groups */}
            {/*{items.map((item, idx) => {
                const groupId = item.uniqueId || `item_${idx}`;
                const groupTasks = tasksByItem[groupId] || [];
                // Always show items, even if no tasks, so user can see what needs doing

                const isExtra = groupId.startsWith('extra');
                const titlePrefix = isExtra ? "Extra: " : `Item ${idx + 1}: `;

                return (
                    <TaskGroup
                        key={groupId}
                        title={`${titlePrefix}${item.descripcion || (item as any).task || ""}`}
                        tasks={groupTasks}
                        staff={staff}
                        onUpdate={onUpdate}
                        onDelete={onDelete}
                        startCollapsed={groupTasks.length === 0}
                    />
                );
            })}*/}

            {/* Mobile Bottom Action Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 z-50">
                <Button className="w-full shadow-lg" onClick={() => setOpenAdd(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Nueva Tarea
                </Button>
            </div>

            {/* Add Task Dialog */}
            <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Descripción</Label>
                            <Input value={newTask.text} onChange={e => setNewTask({ ...newTask, text: e.target.value })} placeholder="Ej: Instalar cableado" />
                        </div>

                        <div className="space-y-2">
                            <Label>Asignado a</Label>
                            <Select value={newTask.assignee || "unassigned"} onValueChange={val => setNewTask({ ...newTask, assignee: val === 'unassigned' ? '' : val })}>
                                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="unassigned">Sin asignar</SelectItem>
                                    {staff.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleAdd}>Crear Tarea</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TaskGroup({ title, tasks, staff, onUpdate, onDelete, startCollapsed = false }: { title: string, tasks: TrackingTask[], staff: string[], onUpdate: any, onDelete: any, startCollapsed?: boolean }) {
    // If no tasks, we show it but maybe collapsed? Actually if startCollapsed is true, we respect it.
    // If there ARE tasks, usually we want it open.
    // Let's default to open if there are tasks, closed if not (if we want to show empty groups).
    // The user wants to SEE the items.

    // We'll use a local state.
    // const [isOpen, setIsOpen] = useState(!startCollapsed); 
    // Collapsible component from shadcn usually is controlled or uncontrolled.
    // Since we are using a Card, we can implement manual collapsible or just show it.

    // For now, let's just render the Card. If empty, it shows "Sin tareas".

    return (
        <Card>
            <CardHeader className="py-3 bg-slate-50 border-b">
                <CardTitle className="text-sm font-medium flex justify-between items-center">
                    {title}
                    <Badge variant="secondary" className="text-xs font-normal">{tasks.length} tareas</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {tasks.length === 0 ? (
                    <div className="p-4 text-xs text-gray-400 italic text-center">Sin tareas registradas.</div>
                ) : (
                    tasks.map(task => (
                        <TaskItem key={task.id} task={task} staff={staff} onUpdate={onUpdate} onDelete={onDelete} />
                    ))
                )}
            </CardContent>
        </Card>
    );
}

function TaskItem({ task, staff, onUpdate, onDelete }: { task: TrackingTask, staff: string[], onUpdate: any, onDelete: any }) {
    const [isOpen, setIsOpen] = useState(false);
    const [newSubtask, setNewSubtask] = useState("");

    const toggleCheck = async () => {
        await onUpdate({ ...task, completed: !task.completed });
    };

    const handleAssign = async (assignee: string) => {
        await onUpdate({ ...task, assignee: assignee === 'unassigned' ? undefined : assignee });
    };

    const addSubtask = async () => {
        if (!newSubtask.trim()) return;
        const sub = {
            id: `sub_${Date.now()}`,
            text: newSubtask,
            completed: false
        };
        const updatedSubtasks = [...(task.subtasks || []), sub];
        await onUpdate({ ...task, subtasks: updatedSubtasks });
        setNewSubtask("");
    };

    const toggleSubtask = async (subId: string) => {
        const updatedSubtasks = (task.subtasks || []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
        await onUpdate({ ...task, subtasks: updatedSubtasks });
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b last:border-0">
            <div className="flex items-center p-3 gap-3 hover:bg-slate-50 group">
                <Checkbox checked={task.completed} onCheckedChange={toggleCheck} />
                <div className="flex-1">
                    <span className={task.completed ? "line-through text-gray-400" : ""}>{task.text}</span>
                </div>

                <Select value={task.assignee || "unassigned"} onValueChange={handleAssign}>
                    <SelectTrigger className="w-[130px] h-7 text-xs border-0 bg-transparent hover:bg-slate-200">
                        {task.assignee ? <Badge variant="secondary" className="mr-1 py-0">{(task.assignee || "").substring(0, 2).toUpperCase()}</Badge> : <User className="h-3 w-3 mr-1 text-gray-400" />}
                        <span className="truncate">{task.assignee || "Asignar"}</span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {staff.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>

                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                        {(task.subtasks?.length || 0) > 0 ? (
                            <span className="text-xs flex items-center gap-1">
                                {task.subtasks?.filter(s => s.completed).length}/{task.subtasks?.length} <ChevronDown className="h-3 w-3" />
                            </span>
                        ) : (
                            <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Subtareas</span>
                        )}
                    </Button>
                </CollapsibleTrigger>

                <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 opacity-0 group-hover:opacity-100" onClick={() => onDelete(task.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>

            {/* Subtasks Area */}
            <CollapsibleContent>
                <div className="pl-10 pr-4 pb-3 bg-slate-50/50">
                    <div className="space-y-2 mt-2">
                        {task.subtasks?.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2 text-sm justify-between group/sub">
                                <div className="flex items-center gap-2">
                                    <Checkbox checked={sub.completed} onCheckedChange={() => toggleSubtask(sub.id)} className="h-2 w-2 md:h-3 md:w-3" />
                                    <span className={sub.completed ? "line-through text-gray-400" : ""}>{sub.text}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                    <Select
                                        value={sub.assignee || "unassigned"}
                                        onValueChange={async (val) => {
                                            const updatedSubtasks = (task.subtasks || []).map(s => s.id === sub.id ? { ...s, assignee: val === 'unassigned' ? undefined : val } : s);
                                            await onUpdate({ ...task, subtasks: updatedSubtasks });
                                        }}
                                    >
                                        <SelectTrigger className="h-6 text-[10px] w-[100px] border-0 bg-transparent hover:bg-slate-200 px-1">
                                            {sub.assignee ? (
                                                <Badge variant="secondary" className="mr-1 py-0 px-1 text-[10px] h-4">{(sub.assignee).substring(0, 2).toUpperCase()}</Badge>
                                            ) : (
                                                <User className="h-3 w-3 mr-1 text-gray-400" />
                                            )}
                                            <span className="truncate">{sub.assignee || "Asignar"}</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                                            {staff.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={async () => {
                                        const updatedSubtasks = (task.subtasks || []).filter(s => s.id !== sub.id);
                                        await onUpdate({ ...task, subtasks: updatedSubtasks });
                                    }}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Input
                            className="h-7 text-xs"
                            placeholder="Nueva subtarea..."
                            value={newSubtask}
                            onChange={e => setNewSubtask(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addSubtask()}
                        />
                        <Button size="sm" variant="secondary" className="h-7" onClick={addSubtask}>Agregar</Button>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}

function ExtraTaskItem({ item, staff, onUpdate }: { item: ItemPresupuesto, staff: string[], onUpdate?: (item: ItemPresupuesto) => Promise<void> }) {
    const [isOpen, setIsOpen] = useState(false);
    const [newSubtask, setNewSubtask] = useState("");

    const toggleCheck = async () => {
        if (onUpdate) await onUpdate({ ...item, completed: !item.completed });
    };

    const handleAssign = async (assignee: string) => {
        if (!onUpdate) return;
        const newItem = { ...item };
        if (assignee === 'unassigned') {
            delete newItem.assignee;
        } else {
            newItem.assignee = assignee;
        }
        await onUpdate(newItem);
    };

    const addSubtask = async () => {
        if (!newSubtask.trim() || !onUpdate) return;
        const sub = {
            id: `sub_${Date.now()}`,
            text: newSubtask,
            completed: false
        };
        const updatedSubtasks = [...(item.subtasks || []), sub];
        await onUpdate({ ...item, subtasks: updatedSubtasks });
        setNewSubtask("");
    };

    const toggleSubtask = async (subId: string) => {
        if (!onUpdate) return;
        const updatedSubtasks = (item.subtasks || []).map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
        await onUpdate({ ...item, subtasks: updatedSubtasks });
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border-b last:border-0">
            <div className="flex items-center p-3 gap-3 hover:bg-slate-50 group">
                <Checkbox checked={item.completed || false} onCheckedChange={toggleCheck} />
                <div className="flex-1">
                    <span className={item.completed ? "line-through text-gray-400" : "text-gray-900"}>{item.descripcion}</span>
                    {item.cantidad > 1 && <span className="text-xs text-gray-500 ml-2">({item.cantidad} {item.unidad})</span>}
                </div>

                <Select value={item.assignee || "unassigned"} onValueChange={handleAssign}>
                    <SelectTrigger className="w-[130px] h-7 text-xs border-0 bg-transparent hover:bg-slate-200">
                        {item.assignee ? <Badge variant="secondary" className="mr-1 py-0">{(item.assignee || "").substring(0, 2).toUpperCase()}</Badge> : <User className="h-3 w-3 mr-1 text-gray-400" />}
                        <span className="truncate">{item.assignee || "Asignar"}</span>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                        {staff.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>

                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                        {(item.subtasks?.length || 0) > 0 ? (
                            <span className="text-xs flex items-center gap-1">
                                {item.subtasks?.filter(s => s.completed).length}/{item.subtasks?.length} <ChevronDown className="h-3 w-3" />
                            </span>
                        ) : (
                            <span className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Subtareas</span>
                        )}
                    </Button>
                </CollapsibleTrigger>

                <Badge variant="secondary" className="text-xs ml-2">Extra</Badge>
            </div>

            {/* Subtasks Area */}
            <CollapsibleContent>
                <div className="pl-10 pr-4 pb-3 bg-amber-50/30">
                    <div className="space-y-2 mt-2">
                        {item.subtasks?.map(sub => (
                            <div key={sub.id} className="flex items-center gap-2 text-sm justify-between group/sub">
                                <div className="flex items-center gap-2">
                                    <Checkbox checked={sub.completed} onCheckedChange={() => toggleSubtask(sub.id)} className="h-2 w-2 md:h-3 md:w-3" />
                                    <span className={sub.completed ? "line-through text-gray-400" : ""}>{sub.text}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                    <Select
                                        value={sub.assignee || "unassigned"}
                                        onValueChange={async (val) => {
                                            if (!onUpdate) return;
                                            const updatedSubtasks = (item.subtasks || []).map(s => {
                                                if (s.id !== sub.id) return s;
                                                const newSub = { ...s };
                                                if (val === 'unassigned') {
                                                    delete newSub.assignee;
                                                } else {
                                                    newSub.assignee = val;
                                                }
                                                return newSub;
                                            });
                                            await onUpdate({ ...item, subtasks: updatedSubtasks });
                                        }}
                                    >
                                        <SelectTrigger className="h-6 text-[10px] w-[100px] border-0 bg-transparent hover:bg-slate-200 px-1">
                                            {sub.assignee ? (
                                                <Badge variant="secondary" className="mr-1 py-0 px-1 text-[10px] h-4">{(sub.assignee).substring(0, 2).toUpperCase()}</Badge>
                                            ) : (
                                                <User className="h-3 w-3 mr-1 text-gray-400" />
                                            )}
                                            <span className="truncate">{sub.assignee || "Asignar"}</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                                            {staff.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={async () => {
                                        if (!onUpdate) return;
                                        const updatedSubtasks = (item.subtasks || []).filter(s => s.id !== sub.id);
                                        await onUpdate({ ...item, subtasks: updatedSubtasks });
                                    }}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Input
                            className="h-7 text-xs"
                            placeholder="Nueva subtarea..."
                            value={newSubtask}
                            onChange={e => setNewSubtask(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addSubtask()}
                        />
                        <Button size="sm" variant="secondary" className="h-7" onClick={addSubtask}>Agregar</Button>
                    </div>
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
