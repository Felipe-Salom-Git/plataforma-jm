export type EstadoPresupuesto = 'draft' | 'pending' | 'approved' | 'in_progress' | 'completed' | 'canceled';
export type TipoItem = 'material' | 'mano_obra';
export type UnidadMedida = 'u' | 'm' | 'ml' | 'kg' | 'lts' | 'global';

export interface EntidadBase {
  id: string;
  createdAt: number; // Timestamp
  updatedAt: number;
  ownerId: string; // ID del usuario/empresa (Multi-tenancy)
  deletedAt?: number | null;
  deletedBy?: string;
}

// --- Cliente ---
export interface Cliente extends EntidadBase {
  id: string;
  ownerId: string;
  nombre: string;
  telefono?: string;
  email?: string;
  direccion?: string;
  cuit?: string; // New
  createdAt: number;
  updatedAt: number;

  // Client Features
  frecuente?: boolean; // New
  lastUsedAt?: number; // New

  // Tracking Info
  lastQuoteId?: string;
  lastQuoteNumber?: string;
  activeTrackingId?: string;
}

// --- Stock / Materiales ---
export interface Material extends EntidadBase {
  nombre: string;
  descripcion?: string;
  unidad: UnidadMedida;
  precioUnitario: number; // Precio base costo
  stockActual: number;
  stockMinimo: number;
}

export interface MovimientoStock extends EntidadBase {
  materialId: string;
  tipo: 'entrada' | 'salida' | 'ajuste';
  cantidad: number;
  referencia?: string; // ID de presupuesto o nota
  fecha: number;
}

// --- Presupuesto ---
export interface ItemPresupuesto {
  id: string; // Generado localmente para keys en React
  tipo: TipoItem;
  descripcion: string; // Nombre copiado del material o costumbre
  cantidad: number;
  unidad: UnidadMedida;
  precioUnitario: number; // Precio de venta (puede diferir del costo)
  precioUnitarioTexto?: string; // Alternativa texto
  materialReferenceId?: string; // Si viene de inventario
  descuento?: number; // Porcentaje o monto fijo
  total: number; // Calculado
  totalTexto?: string; // Alternativa texto
  cantidadTexto?: string; // Alternativa texto

  // Execution State (for Extras)
  completed?: boolean;
  status?: 'planned' | 'bought' | 'used';
  subtasks?: TrackingSubtask[];
  assignee?: string;
}

export interface ClienteSnapshot {
  nombre: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  cuit?: string;
}

export interface ChecklistItem {
  id: string;
  texto: string;
  completado: boolean;
}

export interface Pago {
  id: string;
  monto: number;
  fecha: number;
  metodo: 'efectivo' | 'transferencia' | 'cheque';
  notas?: string;
}

export interface Presupuesto extends EntidadBase {
  numero: string; // Autoincremental o generado
  clienteId: string;
  clienteSnapshot: ClienteSnapshot; // Copia para no depender del cliente original
  titulo: string; // "Instalación Eléctrica Casa X"
  items: ItemPresupuesto[];

  // Totales
  subtotal: number;
  descuentoGlobal: number; // Added
  impuestos?: number;
  total: number;

  // Estado y Gestión
  estado: EstadoPresupuesto;
  validezDias: number;
  observaciones?: string; // Added
  condicionesPago?: string;
  internalNotesText?: string; // Internal notes content

  // Seguimiento (Post-aprobación)
  checklist: ChecklistItem[];
  pagos: Pago[];
  saldoPendiente: number;

  // Archivos
  pdfUrl?: string; // URL firmada o publica del PDF

  // New Config Fields
  materials?: {
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal?: number;
  }[];
  notQuotedItems?: string[];
  paymentMethod?: string;

  // Workflow
  trackingId?: string;
  approvedAt?: number;
}


// --- Tracking ---
export interface TrackingSubtask {
  id: string;
  text: string;
  completed: boolean;
  assignee?: string;
  date?: number;
}

export interface TrackingTask {
  id: string;
  text: string;
  completed: boolean;
  createdAt?: number; // Added
  relatedItemId?: string; // New: Link to budget item
  originalItemId?: string; // Deprecated but keeping for compatibility if used
  priority?: 'low' | 'medium' | 'high';
  plannedDate?: number;
  deadline?: number;
  assignee?: string;
  subtasks?: TrackingSubtask[];
}

export type MaterialStatus = 'planned' | 'bought' | 'used';

export interface TrackingMaterial {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  status: MaterialStatus;
  originalMaterialId?: string;
}

export interface DailyLog {
  id: string;
  date: number;
  content: string;
  author?: string;
}

export interface PromesaPago {
  id: string;
  fecha: number;
  monto: number;
  nota?: string;
  estado: 'pendiente' | 'cumplida' | 'vencida';
}

export type TrackingStatus = 'pending_start' | 'in_progress' | 'waiting_client' | 'ready_to_deliver' | 'delivered' | 'closed' | 'canceled';

export interface Tracking extends EntidadBase {
  quoteId: string;
  quoteNumber: string;
  title: string;

  clientId: string;
  clientSnapshot: ClienteSnapshot;

  quoteSnapshot: Presupuesto; // Copia completa para independencia

  // Execution
  status: TrackingStatus;
  dates?: {
    startedAt?: number;
    deliveredAt?: number;
    closedAt?: number;
    canceledAt?: number;
  };

  tasks: TrackingTask[];
  itemSchedule?: Record<string, { date: number; startTime?: string; endTime?: string; assignee?: string }>; // New: Item Planning
  materials: TrackingMaterial[];
  checklist?: ChecklistItem[]; // New: Delivery Checklist

  schedule?: {
    startDate?: number;
    endDate?: number;
    startTime?: string;
    endTime?: string;
  };
  dailyLogs: DailyLog[];

  // Financials
  extras: ItemPresupuesto[];
  purchases: Compra[];
  pagos: Pago[];
  paymentPromises: PromesaPago[];
  saldoPendiente: number;
  total: number; // Updated Total (Original + Extras)

  presupuestoRef?: string;

  internalNotes?: string;
}



export interface ExtraTemplate extends EntidadBase {
  name: string;
  description: string; // Desc of the item
  unit: string;
  price: number;
}

// --- Calendario ---
export interface EventoCalendario extends EntidadBase {
  titulo: string;
  descripcion?: string;
  inicio: number;
  fin: number;
  tipo: 'trabajo' | 'visita' | 'recordatorio';
  presupuestoId?: string; // Link opcional
}

// --- Administrativo / Gastos ---
export interface TransaccionManual extends EntidadBase {
  fecha: number;
  tipo: 'ingreso' | 'gasto';
  categoria: string;
  descripcion: string;
  monto: number;
}

export interface Compra {
  id: string;
  fecha: number;
  monto: number;
  proveedor: string;
  nota?: string;
}

export interface Gasto extends EntidadBase {
  fecha: number;
  categoria: string;
  descripcion: string;
  monto: number;
}
