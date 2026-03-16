export type UserRole = "client" | "master";
export type ReservationSource = "whatsapp" | "panel" | "manual" | "api";

export interface User {
  id: string;
  name: string;
  email: string;
  company: string;
  role: UserRole;
  themePreference?: "dark" | "light";
  agentName?: string;
  status: "active" | "inactive" | "blocked";
  lastLogin: string;
  createdAt: string;
  mustChangePassword?: boolean;
  whatsappConnected: boolean;
  whatsappNumber?: string;
  lastSync?: string;
}

export interface Room {
  id: number;
  name: string;
  floor: number;
  capacity: number;
  status: "active" | "inactive";
  color: string;
  description: string;
  clientId: string;
}

export interface Reservation {
  id: string;
  roomId: number;
  roomName: string;
  personName: string;
  date: string;
  startTime: string;
  endTime: string;
  meetingLink?: string | null;
  participants: number;
  status: "confirmed" | "cancelled" | "completed";
  source?: ReservationSource;
  roomColor: string;
  cancelledAt?: string;
  cancelReason?: string;
  clientId: string;
  floor?: number;
}

export interface Ticket {
  id: string;
  clientId: string;
  clientName: string;
  company: string;
  email: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
  assignedToId?: string;
  assignedTo?: string;
  notes?: TicketNote[];
}

export interface TicketNote {
  id: string;
  text: string;
  author: string;
  createdAt: string;
  internal?: boolean;
  attachments?: TicketAttachment[];
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  downloadUrl: string;
}

const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0];

export const masterUser: User = {
  id: "master-1",
  name: "Admin Syntra",
  email: "admin@syntra.com",
  company: "Syntra",
  role: "master",
  status: "active",
  lastLogin: today,
  createdAt: "2024-01-15",
  whatsappConnected: true,
};

export const clients: User[] = [
  { id: "c1", name: "Carlos Mendes", email: "carlos@techcorp.com", company: "TechCorp", role: "client", agentName: "Agente TechCorp", status: "active", lastLogin: today, createdAt: "2024-06-15", whatsappConnected: true, whatsappNumber: "+55 11 99999-0001", lastSync: `${today} 14:32` },
  { id: "c2", name: "Ana Garcia", email: "ana@startupx.com", company: "StartupX", role: "client", agentName: "Agente StartupX", status: "active", lastLogin: today, createdAt: "2024-07-01", whatsappConnected: true, whatsappNumber: "+55 11 99999-0002", lastSync: `${today} 13:10` },
  { id: "c3", name: "Roberto Silva", email: "roberto@megacorp.com", company: "MegaCorp", role: "client", agentName: "Agente MegaCorp", status: "active", lastLogin: yesterday, createdAt: "2024-05-20", whatsappConnected: false },
  { id: "c4", name: "Maria Lopes", email: "maria@inovatech.com", company: "InovaTech", role: "client", agentName: "Agente InovaTech", status: "active", lastLogin: today, createdAt: "2024-08-10", whatsappConnected: true, whatsappNumber: "+55 21 99999-0003", lastSync: `${today} 12:45` },
  { id: "c5", name: "Diego Torres", email: "diego@cloudbase.io", company: "CloudBase", role: "client", agentName: "Agente CloudBase", status: "active", lastLogin: yesterday, createdAt: "2024-04-01", whatsappConnected: true, whatsappNumber: "+55 31 99999-0004", lastSync: `${yesterday} 18:20` },
  { id: "c6", name: "Laura Vega", email: "laura@designhub.com", company: "DesignHub", role: "client", agentName: "Agente DesignHub", status: "blocked", lastLogin: "2024-12-01", createdAt: "2024-09-05", whatsappConnected: false },
  { id: "c7", name: "Pedro Ramirez", email: "pedro@salesforce.br", company: "SalesForce BR", role: "client", agentName: "Agente SalesForceBR", status: "active", lastLogin: today, createdAt: "2024-03-15", whatsappConnected: true, whatsappNumber: "+55 11 99999-0005", lastSync: `${today} 15:00` },
  { id: "c8", name: "Sofia Herrera", email: "sofia@financeplus.com", company: "FinancePlus", role: "client", agentName: "Agente FinancePlus", status: "active", lastLogin: today, createdAt: "2024-10-20", whatsappConnected: true, whatsappNumber: "+55 41 99999-0006", lastSync: `${today} 11:30` },
  { id: "c9", name: "João Almeida", email: "joao@datapro.com.br", company: "DataPro", role: "client", agentName: "Agente DataPro", status: "active", lastLogin: yesterday, createdAt: "2024-02-28", whatsappConnected: true, whatsappNumber: "+55 51 99999-0007", lastSync: `${yesterday} 17:40` },
  { id: "c10", name: "Camila Santos", email: "camila@webflow.br", company: "WebFlow BR", role: "client", agentName: "Agente WebFlow", status: "active", lastLogin: today, createdAt: "2024-11-01", whatsappConnected: true, whatsappNumber: "+55 11 99999-0008", lastSync: `${today} 09:15` },
  { id: "c11", name: "Thiago Oliveira", email: "thiago@appsmart.com", company: "AppSmart", role: "client", agentName: "Agente AppSmart", status: "active", lastLogin: today, createdAt: "2024-06-30", whatsappConnected: true, whatsappNumber: "+55 21 99999-0009", lastSync: `${today} 10:20` },
  { id: "c12", name: "Fernanda Costa", email: "fernanda@logistica.com", company: "LogísticaMax", role: "client", agentName: "Agente LogísticaMax", status: "inactive", lastLogin: "2024-11-15", createdAt: "2024-01-20", whatsappConnected: false },
  { id: "c13", name: "Lucas Pereira", email: "lucas@edtech.com", company: "EdTech Brasil", role: "client", agentName: "Agente EdTech", status: "active", lastLogin: today, createdAt: "2024-07-15", whatsappConnected: true, whatsappNumber: "+55 61 99999-0010", lastSync: `${today} 08:50` },
  { id: "c14", name: "Beatriz Martins", email: "beatriz@healthplus.com", company: "HealthPlus", role: "client", agentName: "Agente HealthPlus", status: "active", lastLogin: yesterday, createdAt: "2024-08-25", whatsappConnected: true, whatsappNumber: "+55 71 99999-0011", lastSync: `${yesterday} 16:00` },
  { id: "c15", name: "Rafael Souza", email: "rafael@construtec.com", company: "ConstruTec", role: "client", agentName: "Agente ConstruTec", status: "active", lastLogin: today, createdAt: "2024-09-10", whatsappConnected: false },
  { id: "c16", name: "Isabela Ferreira", email: "isabela@foodtech.com", company: "FoodTech", role: "client", agentName: "Agente FoodTech", status: "active", lastLogin: today, createdAt: "2024-10-05", whatsappConnected: true, whatsappNumber: "+55 85 99999-0012", lastSync: `${today} 07:30` },
  { id: "c17", name: "Gustavo Lima", email: "gustavo@autotech.com", company: "AutoTech", role: "client", agentName: "Agente AutoTech", status: "active", lastLogin: yesterday, createdAt: "2024-04-18", whatsappConnected: true, whatsappNumber: "+55 48 99999-0013", lastSync: `${yesterday} 19:10` },
  { id: "c18", name: "Mariana Ribeiro", email: "mariana@retailpro.com", company: "RetailPro", role: "client", agentName: "Agente RetailPro", status: "active", lastLogin: today, createdAt: "2024-05-25", whatsappConnected: true, whatsappNumber: "+55 27 99999-0014", lastSync: `${today} 13:45` },
  { id: "c19", name: "André Nascimento", email: "andre@energysol.com", company: "EnergySol", role: "client", agentName: "Agente EnergySol", status: "active", lastLogin: today, createdAt: "2024-11-20", whatsappConnected: true, whatsappNumber: "+55 62 99999-0015", lastSync: `${today} 14:00` },
  { id: "c20", name: "Juliana Campos", email: "juliana@pharmatech.com", company: "PharmaTech", role: "client", agentName: "Agente PharmaTech", status: "active", lastLogin: yesterday, createdAt: "2024-12-01", whatsappConnected: true, whatsappNumber: "+55 92 99999-0016", lastSync: `${yesterday} 20:30` },
];

export const rooms: Room[] = [
  { id: 1, name: "Sala Nebula", floor: 1, capacity: 10, status: "active", color: "#7C3AED", description: "Sala de conferência principal com projetor e som", clientId: "c1" },
  { id: 2, name: "Sala Aurora", floor: 1, capacity: 6, status: "active", color: "#6B46C1", description: "Sala de reunião executiva", clientId: "c1" },
  { id: 3, name: "Sala Cosmos", floor: 2, capacity: 20, status: "active", color: "#3B82F6", description: "Auditório para eventos e apresentações", clientId: "c1" },
  { id: 4, name: "Sala Orion", floor: 2, capacity: 4, status: "active", color: "#6366F1", description: "Sala de huddle para reuniões rápidas", clientId: "c1" },
  { id: 5, name: "Sala Eclipse", floor: 3, capacity: 12, status: "inactive", color: "#8B5CF6", description: "Sala de diretoria premium", clientId: "c1" },
  { id: 6, name: "Sala Pulsar", floor: 3, capacity: 8, status: "active", color: "#818CF8", description: "Sala de workshop criativo", clientId: "c1" },
  { id: 7, name: "Sala Vega", floor: 1, capacity: 15, status: "active", color: "#A78BFA", description: "Sala de treinamento", clientId: "c1" },
  { id: 8, name: "Sala Lyra", floor: 2, capacity: 6, status: "active", color: "#C4B5FD", description: "Sala de brainstorm", clientId: "c1" },
];

export const reservations: Reservation[] = [
  { id: "r1", roomId: 1, roomName: "Sala Nebula", personName: "Carlos Mendes", date: today, startTime: "09:00", endTime: "10:00", participants: 5, status: "confirmed", roomColor: "#7C3AED", clientId: "c1", floor: 1 },
  { id: "r2", roomId: 2, roomName: "Sala Aurora", personName: "Fernanda Oliveira", date: today, startTime: "10:00", endTime: "11:30", participants: 3, status: "confirmed", roomColor: "#6B46C1", clientId: "c1", floor: 1 },
  { id: "r3", roomId: 3, roomName: "Sala Cosmos", personName: "Roberto Silva", date: today, startTime: "14:00", endTime: "16:00", participants: 15, status: "confirmed", roomColor: "#3B82F6", clientId: "c1", floor: 2 },
  { id: "r4", roomId: 4, roomName: "Sala Orion", personName: "Maria Lopes", date: today, startTime: "11:00", endTime: "12:00", participants: 2, status: "confirmed", roomColor: "#6366F1", clientId: "c1", floor: 2 },
  { id: "r5", roomId: 1, roomName: "Sala Nebula", personName: "Diego Torres", date: today, startTime: "15:00", endTime: "16:30", participants: 8, status: "confirmed", roomColor: "#7C3AED", clientId: "c1", floor: 1 },
  { id: "r6", roomId: 6, roomName: "Sala Pulsar", personName: "Laura Vega", date: today, startTime: "09:30", endTime: "10:30", participants: 6, status: "confirmed", roomColor: "#818CF8", clientId: "c1", floor: 3 },
  { id: "r7", roomId: 7, roomName: "Sala Vega", personName: "Thiago Oliveira", date: today, startTime: "13:00", endTime: "14:30", participants: 10, status: "confirmed", roomColor: "#A78BFA", clientId: "c1", floor: 1 },
  { id: "r8", roomId: 8, roomName: "Sala Lyra", personName: "Patrícia Dias", date: today, startTime: "16:00", endTime: "17:00", participants: 4, status: "confirmed", roomColor: "#C4B5FD", clientId: "c1", floor: 2 },
  { id: "r9", roomId: 2, roomName: "Sala Aurora", personName: "Pedro Ramirez", date: today, startTime: "13:00", endTime: "14:00", participants: 4, status: "cancelled", roomColor: "#6B46C1", cancelledAt: today, cancelReason: "Reunião remarcada pelo cliente", clientId: "c1", floor: 1 },
  { id: "r10", roomId: 3, roomName: "Sala Cosmos", personName: "Sofia Herrera", date: today, startTime: "08:00", endTime: "09:00", participants: 10, status: "cancelled", roomColor: "#3B82F6", cancelledAt: yesterday, cancelReason: "Cliente cancelou via WhatsApp", clientId: "c1", floor: 2 },
  { id: "r11", roomId: 1, roomName: "Sala Nebula", personName: "Lucas Pereira", date: yesterday, startTime: "10:00", endTime: "11:00", participants: 7, status: "completed", roomColor: "#7C3AED", clientId: "c1", floor: 1 },
  { id: "r12", roomId: 4, roomName: "Sala Orion", personName: "Beatriz Martins", date: yesterday, startTime: "14:00", endTime: "15:00", participants: 3, status: "completed", roomColor: "#6366F1", clientId: "c1", floor: 2 },
  { id: "r13", roomId: 6, roomName: "Sala Pulsar", personName: "Gustavo Lima", date: yesterday, startTime: "09:00", endTime: "10:00", participants: 5, status: "completed", roomColor: "#818CF8", clientId: "c1", floor: 3 },
  { id: "r14", roomId: 7, roomName: "Sala Vega", personName: "Mariana Ribeiro", date: twoDaysAgo, startTime: "15:00", endTime: "16:30", participants: 12, status: "completed", roomColor: "#A78BFA", clientId: "c1", floor: 1 },
  { id: "r15", roomId: 3, roomName: "Sala Cosmos", personName: "André Nascimento", date: twoDaysAgo, startTime: "10:00", endTime: "12:00", participants: 18, status: "cancelled", roomColor: "#3B82F6", cancelledAt: twoDaysAgo, cancelReason: "Evento adiado", clientId: "c1", floor: 2 },
];

export const tickets: Ticket[] = [
  {
    id: "t1", clientId: "c1", clientName: "Carlos Mendes", company: "TechCorp", email: "carlos@techcorp.com",
    title: "QR Code não carrega na página de conexão",
    description: "O QR Code na página de conexão do WhatsApp não está aparecendo corretamente. Já tentei recarregar a página e limpar o cache.",
    status: "open", createdAt: today, updatedAt: today,
    notes: [{ id: "n1", text: "Chamado aberto pelo cliente", author: "Carlos Mendes", createdAt: today }]
  },
  {
    id: "t2", clientId: "c2", clientName: "Ana Garcia", company: "StartupX", email: "ana@startupx.com",
    title: "Agente não responde mensagens no WhatsApp",
    description: "O agente de IA parou de responder mensagens no WhatsApp desde ontem às 15h. Os clientes estão reclamando.",
    status: "in_progress", createdAt: yesterday, updatedAt: today, assignedTo: "Suporte Syntra",
    notes: [
      { id: "n2", text: "Verificando logs do agente de IA", author: "Suporte Syntra", createdAt: yesterday, internal: true },
      { id: "n3", text: "Identificado problema no webhook. Corrigindo.", author: "Suporte Syntra", createdAt: today, internal: true },
    ]
  },
  {
    id: "t3", clientId: "c3", clientName: "Roberto Silva", company: "MegaCorp", email: "roberto@megacorp.com",
    title: "Erro ao cadastrar nova sala",
    description: "Ao tentar cadastrar uma nova sala, aparece um erro de validação no campo capacidade máxima.",
    status: "resolved", createdAt: "2025-03-05", updatedAt: "2025-03-07", assignedTo: "Suporte Syntra",
    notes: [
      { id: "n4", text: "Bug identificado na validação do formulário", author: "Suporte Syntra", createdAt: "2025-03-06", internal: true },
      { id: "n5", text: "Correção aplicada na versão 2.1.3", author: "Suporte Syntra", createdAt: "2025-03-07", internal: true },
      { id: "n6", text: "Problema resolvido. Obrigado!", author: "Roberto Silva", createdAt: "2025-03-07" },
    ]
  },
  {
    id: "t4", clientId: "c4", clientName: "Maria Lopes", company: "InovaTech", email: "maria@inovatech.com",
    title: "Reservas duplicadas no calendário",
    description: "Estão aparecendo reservas duplicadas na visualização semanal do calendário. Isso está confundindo nossa equipe.",
    status: "open", createdAt: today, updatedAt: today,
    notes: [{ id: "n7", text: "Chamado registrado. Aguardando análise.", author: "Sistema", createdAt: today }]
  },
  {
    id: "t5", clientId: "c5", clientName: "Diego Torres", company: "CloudBase", email: "diego@cloudbase.io",
    title: "Solicito alteração no horário de funcionamento",
    description: "Preciso alterar o horário de funcionamento das salas para 7h às 22h, pois temos reuniões no período noturno.",
    status: "in_progress", createdAt: "2025-03-07", updatedAt: today, assignedTo: "Suporte Syntra",
    notes: [
      { id: "n8", text: "Analisando viabilidade da alteração", author: "Suporte Syntra", createdAt: "2025-03-07", internal: true },
    ]
  },
  {
    id: "t6", clientId: "c1", clientName: "Carlos Mendes", company: "TechCorp", email: "carlos@techcorp.com",
    title: "Como exportar relatório de reservas?",
    description: "Gostaria de saber se é possível exportar um relatório com todas as reservas do mês em PDF ou Excel.",
    status: "resolved", createdAt: twoDaysAgo, updatedAt: yesterday, assignedTo: "Suporte Syntra",
    notes: [
      { id: "n9", text: "Funcionalidade de exportação será incluída na próxima atualização.", author: "Suporte Syntra", createdAt: twoDaysAgo, internal: true },
      { id: "n10", text: "Informamos ao cliente sobre a previsão de lançamento.", author: "Suporte Syntra", createdAt: yesterday },
    ]
  },
];

export const roomUsageData = [
  { name: "Nebula", reservas: 28, color: "#7C3AED" },
  { name: "Cosmos", reservas: 24, color: "#3B82F6" },
  { name: "Aurora", reservas: 21, color: "#6B46C1" },
  { name: "Vega", reservas: 19, color: "#A78BFA" },
  { name: "Pulsar", reservas: 16, color: "#818CF8" },
  { name: "Orion", reservas: 14, color: "#6366F1" },
  { name: "Lyra", reservas: 11, color: "#C4B5FD" },
];

// Helper functions
export function getClientRooms(clientId: string) {
  return rooms.filter(r => r.clientId === clientId);
}

export function getClientReservations(clientId: string) {
  return reservations.filter(r => r.clientId === clientId);
}

export function getClientTickets(clientId: string) {
  return tickets.filter(t => t.clientId === clientId);
}

export function getTodayReservations(clientId: string) {
  return reservations.filter(r => r.clientId === clientId && r.date === today && r.status === "confirmed");
}

export function getCancelledReservations(clientId: string) {
  return reservations.filter(r => r.clientId === clientId && r.status === "cancelled");
}

export function getOccupiedRoomsToday(clientId: string) {
  const todayConfirmed = getTodayReservations(clientId);
  const uniqueRoomIds = [...new Set(todayConfirmed.map(r => r.roomId))];
  return uniqueRoomIds.length;
}
