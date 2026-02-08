"use client";

import * as React from "react";
import { Search, Star, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ClientsService } from "@/lib/services/clients";
import { useTenant } from "@/lib/hooks/useTenant";
import { Cliente } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

interface ClientPickerProps {
    valueClientId?: string;
    onSelect: (client: Cliente) => void;
    currentName?: string; // Standard display
    onNameChange?: (name: string) => void; // New prop for free typing
    className?: string;
}

export function ClientPicker({ valueClientId, onSelect, currentName, onNameChange, className }: ClientPickerProps) {
    const { tenantId } = useTenant();
    const [openModal, setOpenModal] = React.useState(false);

    // Data state for modal
    const [clients, setClients] = React.useState<Cliente[]>([]);

    const handleSelect = (client: Cliente) => {
        onSelect(client);
        setOpenModal(false);
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {/* SIMPLE INPUT for Name */}
            <div className="relative flex-1">
                <Input
                    value={currentName || ""}
                    onChange={(e) => onNameChange?.(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="bg-white text-black border-slate-300 placeholder:text-slate-500"
                />
            </div>

            {/* SEARCH MODAL BUTTON */}
            <Button
                variant="outline"
                size="icon"
                onClick={() => setOpenModal(true)}
                title="Búsqueda avanzada"
                type="button"
                className="bg-white text-black border-slate-300 hover:bg-slate-50 hover:text-black shrink-0"
            >
                <Search className="h-4 w-4" />
            </Button>

            {/* FULL SEARCH MODAL */}
            <Dialog open={openModal} onOpenChange={setOpenModal}>
                <DialogContent className="p-0 gap-0 max-w-md overflow-hidden">
                    <DialogHeader className="px-4 py-3 border-b">
                        <DialogTitle className="text-sm font-medium">Lista de Clientes</DialogTitle>
                    </DialogHeader>

                    <ClientSearchList onSelect={handleSelect} tenantId={tenantId} />

                    <div className="p-2 border-t bg-slate-50 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => setOpenModal(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// Reusing logic for the modal list
function ClientSearchList({ onSelect, tenantId }: { onSelect: (c: Cliente) => void; tenantId?: string }) {
    const [searchTerm, setSearchTerm] = React.useState("");
    const [clients, setClients] = React.useState<Cliente[]>([]);
    const [filtered, setFiltered] = React.useState<Cliente[]>([]);

    React.useEffect(() => {
        if (!tenantId) return;
        ClientsService.search(tenantId, "").then(res => {
            setClients(res);
            setFiltered(res);
        });
    }, [tenantId]);

    React.useEffect(() => {
        if (!searchTerm) {
            setFiltered(clients);
            return;
        }
        const lower = searchTerm.toLowerCase();
        setFiltered(clients.filter(c =>
            c.nombre.toLowerCase().includes(lower) ||
            c.email?.toLowerCase().includes(lower) ||
            c.telefono?.includes(lower)
        ));
    }, [searchTerm, clients]);

    return (
        <div className="flex flex-col h-[400px]">
            <div className="p-2 border-b">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por nombre, email o teléfono..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 border-0 bg-slate-50 focus-visible:ring-0"
                        autoFocus
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-1">
                {filtered.map(client => (
                    <button
                        key={client.id}
                        onClick={() => onSelect(client)}
                        className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 transition-colors text-left group"
                    >
                        <div className={`p-2 rounded-full ${client.frecuente ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-200 text-slate-600'}`}>
                            {client.frecuente ? <Star className="h-4 w-4 fill-yellow-600" /> : <User className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <div className="font-medium truncate text-sm">{client.nombre}</div>
                            {(client.email || client.telefono) && (
                                <div className="text-xs text-muted-foreground truncate">
                                    {client.email} {client.email && client.telefono && "•"} {client.telefono}
                                </div>
                            )}
                        </div>
                        {client.frecuente && <Badge variant="secondary" className="text-[10px] h-5">Frecuente</Badge>}
                    </button>
                ))}
                {filtered.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">No se encontraron clientes</div>}
            </div>
        </div>
    )
}
