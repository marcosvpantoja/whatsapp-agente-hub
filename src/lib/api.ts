import type { Reservation, Room, Ticket, User } from "@/lib/mockData";

export interface AttachmentUploadPayload {
  fileName: string;
  mimeType: string;
  contentBase64: string;
}

export interface SupportUser {
  id: string;
  name: string;
  email: string;
}

export interface SettingsData {
  systemName: string;
  timezone: string;
  themePreference: "dark" | "light";
  bookingStartTime: string;
  bookingEndTime: string;
  maxParticipants: number;
  minAdvanceMinutes: number;
  emailEnabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: "none" | "starttls" | "ssl_tls";
  smtpUsername: string;
  smtpPassword: string;
  smtpPasswordConfigured: boolean;
  smtpFromName: string;
  smtpFromEmail: string;
  smtpReplyToEmail: string;
}

export interface WhatsappData {
  id: string;
  status: "connected" | "disconnected" | "pending" | "error";
  phoneNumber: string | null;
  displayName: string | null;
  lastSync: string | null;
  reservationsToday: number;
  connected: boolean;
  messagesToday: number;
  connectionState?: string | null;
  instanceName?: string | null;
  qrCodeBase64?: string | null;
}

export interface DashboardData {
  metrics: Array<{ label: string; value: number }>;
  confirmedReservations: Reservation[];
  cancelledReservations: Reservation[];
}

export interface MasterDashboardData {
  metrics: Array<{ label: string; value: number }>;
  recentClients: User[];
  recentTickets: Ticket[];
  topClients: Array<{ id: string; company: string; reservations: number }>;
}

export interface ClientProfileData {
  client: User;
  rooms: Room[];
  reservations: Reservation[];
  tickets: Ticket[];
  settings: SettingsData;
  whatsapp: WhatsappData;
}

export interface CreateClientResponse {
  client: User;
  temporaryPassword: string;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const hasBody = init.body !== undefined && init.body !== null;

  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : "Erro na comunicação com o servidor.";
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

export const api = {
  auth: {
    me: () => request<{ user: User }>("/api/auth/me"),
    login: (email: string, password: string) =>
      request<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    changePassword: (payload: { currentPassword?: string; newPassword: string; confirmPassword: string }) =>
      request<{ user: User }>("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    logout: () =>
      request<void>("/api/auth/logout", {
        method: "POST",
      }),
  },
  client: {
    dashboard: () => request<DashboardData>("/api/client/dashboard"),
    rooms: () => request<Room[]>("/api/client/rooms"),
    createRoom: (payload: { name: string; floor: number; capacity: number; description: string; color: string; active: boolean }) =>
      request<Room>("/api/client/rooms", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateRoom: (roomId: number, payload: { name: string; floor: number; capacity: number; description: string; color: string; active: boolean }) =>
      request<Room>(`/api/client/rooms/${roomId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    deleteRoom: (roomId: number) =>
      request<void>(`/api/client/rooms/${roomId}`, {
        method: "DELETE",
      }),
    reservations: () => request<Reservation[]>("/api/client/reservations"),
    createReservation: (payload: { roomId: number; personName: string; date: string; startTime: string; endTime: string; meetingLink?: string; participants: number }) =>
      request<Reservation>("/api/client/reservations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    updateReservation: (
      reservationId: string,
      payload: { roomId: number; personName: string; date: string; startTime: string; endTime: string; meetingLink?: string; participants: number },
    ) =>
      request<Reservation>(`/api/client/reservations/${reservationId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    cancelReservation: (reservationId: string) =>
      request<void>(`/api/client/reservations/${reservationId}/cancel`, {
        method: "PATCH",
      }),
    settings: () => request<SettingsData>("/api/client/settings"),
    updateSettings: (payload: SettingsData) =>
      request<SettingsData>("/api/client/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    whatsapp: () => request<WhatsappData>("/api/client/whatsapp"),
    connectWhatsapp: () =>
      request<WhatsappData>("/api/client/whatsapp/connect", {
        method: "POST",
      }),
    disconnectWhatsapp: () =>
      request<WhatsappData>("/api/client/whatsapp/disconnect", {
        method: "POST",
      }),
    tickets: () => request<Ticket[]>("/api/client/tickets"),
    createTicket: (payload: { title: string; description: string; attachments?: AttachmentUploadPayload[] }) =>
      request<Ticket>("/api/client/tickets", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    addTicketNote: (ticketId: string, payload: { text: string; attachments?: AttachmentUploadPayload[] }) =>
      request<Ticket>(`/api/client/tickets/${ticketId}/notes`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
  master: {
    dashboard: () => request<MasterDashboardData>("/api/master/dashboard"),
    clients: (search = "") =>
      request<User[]>(`/api/master/clients${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    createClient: (payload: { name: string; email: string; company: string; agentName?: string }) =>
      request<CreateClientResponse>("/api/master/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    clientProfile: (clientId: string) => request<ClientProfileData>(`/api/master/clients/${clientId}`),
    updateClient: (
      clientId: string,
      payload: { name: string; email: string; company: string; agentName?: string; whatsappNumber?: string | null },
    ) =>
      request<ClientProfileData>(`/api/master/clients/${clientId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    updateClientStatus: (clientId: string, status: "active" | "inactive" | "blocked") =>
      request<User>(`/api/master/clients/${clientId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    resetClientPassword: (clientId: string) =>
      request<{ temporaryPassword: string }>(`/api/master/clients/${clientId}/reset-password`, {
        method: "POST",
      }),
    tickets: (search = "", status = "all") =>
      request<Ticket[]>(
        `/api/master/tickets?search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`,
      ),
    supportUsers: () => request<SupportUser[]>("/api/master/support-users"),
    updateTicketStatus: (ticketId: string, status: "open" | "in_progress" | "resolved") =>
      request<void>(`/api/master/tickets/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    assignTicket: (ticketId: string, assignedToUserId: string | null) =>
      request<Ticket>(`/api/master/tickets/${ticketId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ assignedToUserId }),
      }),
    addTicketNote: (ticketId: string, payload: { text: string; internal: boolean; attachments?: AttachmentUploadPayload[] }) =>
      request<Ticket>(`/api/master/tickets/${ticketId}/notes`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  },
};
