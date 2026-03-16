import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Clock, Pencil, Plus, Search, Users, X } from "lucide-react";
import type { DayContentProps } from "react-day-picker";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Reservation, Room } from "@/lib/mockData";
import { api, type SettingsData } from "@/lib/api";
import { buildTimeOptions } from "@/lib/time";

type ReservationFormState = {
  date: string;
  roomId: string;
  personName: string;
  startTime: string;
  endTime: string;
  meetingLink: string;
  participants: string;
};

const fallbackSettings: SettingsData = {
  systemName: "Syntra",
  timezone: "America/Sao_Paulo",
  themePreference: "dark",
  bookingStartTime: "08:00",
  bookingEndTime: "20:00",
  maxParticipants: 30,
  minAdvanceMinutes: 30,
  emailEnabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpSecurity: "starttls",
  smtpUsername: "",
  smtpPassword: "",
  smtpPasswordConfigured: false,
  smtpFromName: "",
  smtpFromEmail: "",
  smtpReplyToEmail: "",
};

const MAX_VISIBLE_DAY_INDICATORS = 8;

function createReservationForm(date = "", roomId = "", startTime = "", endTime = "", meetingLink = ""): ReservationFormState {
  return {
    date,
    roomId,
    personName: "",
    startTime,
    endTime,
    meetingLink,
    participants: "1",
  };
}

function formatReservationDateLabel(dateValue: string) {
  if (!dateValue) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateValue}T12:00:00`));
}

function sortReservations(items: Reservation[]) {
  return [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    return left.startTime.localeCompare(right.startTime);
  });
}

function getReservationSourceLabel(source?: Reservation["source"]) {
  switch (source) {
    case "panel":
      return "Painel";
    case "manual":
      return "Manual";
    case "api":
      return "API";
    case "whatsapp":
    default:
      return "WhatsApp";
  }
}

function ReservationDayContent({
  date,
  displayMonth: _displayMonth,
  activeModifiers,
  dayIndicators,
}: DayContentProps & { dayIndicators: Record<string, string[]> }) {
  const dayKey = format(date, "yyyy-MM-dd");
  const indicators = dayIndicators[dayKey] || [];

  return (
    <div className="flex h-full w-full flex-col items-center justify-between px-1.5 pb-1.5 pt-2">
      <span className="text-sm font-medium leading-none">
        {date.getDate()}
      </span>
      {indicators.length > 0 && !activeModifiers.hidden ? (
        <div className="flex h-1.5 w-full overflow-hidden rounded-full">
          {indicators.map((color, index) => (
            <span
              key={`${dayKey}-${color}-${index}`}
              className="h-full flex-1"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      ) : (
        <span className="block h-1.5 w-full" />
      )}
    </div>
  );
}

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [roomFilter, setRoomFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<SettingsData>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Reservation | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [savingReservation, setSavingReservation] = useState(false);
  const [reservationForm, setReservationForm] = useState<ReservationFormState>(createReservationForm());

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        const [roomsResponse, reservationsResponse, settingsResponse] = await Promise.all([
          api.client.rooms(),
          api.client.reservations(),
          api.client.settings(),
        ]);

        if (active) {
          setRooms(roomsResponse);
          setReservations(reservationsResponse);
          setSettings(settingsResponse);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar a agenda.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, []);

  const selectedDate = useMemo(
    () => (date ? date.toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
    [date],
  );

  const floors = useMemo(
    () => [...new Set(rooms.map((room) => room.floor))].sort((a, b) => a - b),
    [rooms],
  );

  const activeRooms = useMemo(
    () => rooms.filter((room) => room.status === "active"),
    [rooms],
  );

  const selectedDateLabel = useMemo(() => formatReservationDateLabel(selectedDate), [selectedDate]);

  const reservationFormDateLabel = useMemo(
    () => formatReservationDateLabel(reservationForm.date),
    [reservationForm.date],
  );

  const selectedEventRefreshed = useMemo(
    () => reservations.find((reservation) => reservation.id === selectedEvent?.id) || selectedEvent,
    [reservations, selectedEvent],
  );

  const selectedRoomForForm = useMemo(
    () => rooms.find((room) => String(room.id) === reservationForm.roomId) || null,
    [rooms, reservationForm.roomId],
  );

  const availableRoomsForForm = useMemo(
    () =>
      selectedRoomForForm && !activeRooms.some((room) => room.id === selectedRoomForForm.id)
        ? [selectedRoomForForm, ...activeRooms]
        : activeRooms,
    [activeRooms, selectedRoomForForm],
  );

  const timeOptions = useMemo(
    () => buildTimeOptions(settings.bookingStartTime, settings.bookingEndTime),
    [settings.bookingEndTime, settings.bookingStartTime],
  );

  const startTimeOptions = useMemo(
    () => (timeOptions.length > 1 ? timeOptions.slice(0, -1) : []),
    [timeOptions],
  );

  const endTimeOptions = useMemo(
    () => timeOptions.filter((option) => option > reservationForm.startTime),
    [reservationForm.startTime, timeOptions],
  );

  const hasAvailableTimeRange = startTimeOptions.length > 0 && endTimeOptions.length > 0;

  const filtered = useMemo(
    () =>
      reservations.filter((reservation) => {
        const room = rooms.find((item) => item.id === reservation.roomId);
        return (
          reservation.date === selectedDate &&
          reservation.status === "confirmed" &&
          (roomFilter === "all" || String(reservation.roomId) === roomFilter) &&
          (floorFilter === "all" || room?.floor === Number(floorFilter)) &&
          (search === "" || reservation.personName.toLowerCase().includes(search.toLowerCase()))
        );
      }),
    [reservations, rooms, selectedDate, roomFilter, floorFilter, search],
  );

  const reservationIndicatorsByDate = useMemo(() => {
    const indicatorsByDate = new Map<string, Map<number, string>>();

    for (const reservation of reservations) {
      if (reservation.status === "cancelled") {
        continue;
      }

      const roomIndicators = indicatorsByDate.get(reservation.date) || new Map<number, string>();
      roomIndicators.set(reservation.roomId, reservation.roomColor);
      indicatorsByDate.set(reservation.date, roomIndicators);
    }

    return Array.from(indicatorsByDate.entries()).reduce<Record<string, string[]>>((accumulator, [day, colors]) => {
      accumulator[day] = Array.from(colors.values()).slice(0, MAX_VISIBLE_DAY_INDICATORS);
      return accumulator;
    }, {});
  }, [reservations]);

  const getDefaultReservationForm = (reservationDate = selectedDate, roomId = String(activeRooms[0]?.id ?? "")) => {
    const defaultStartTime = startTimeOptions[0] || "";
    const defaultEndTime = timeOptions.find((option) => option > defaultStartTime) || "";
    return createReservationForm(reservationDate, roomId, defaultStartTime, defaultEndTime);
  };

  const getEditReservationForm = (reservation: Reservation) =>
    ({
      date: reservation.date,
      roomId: String(reservation.roomId),
      personName: reservation.personName,
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      meetingLink: reservation.meetingLink || "",
      participants: String(reservation.participants),
    }) satisfies ReservationFormState;

  const closeReservationDialog = () => {
    setCreateDialogOpen(false);
    setEditingReservationId(null);
    setReservationForm(getDefaultReservationForm());
  };

  const handleCreateDialogChange = (open: boolean) => {
    if (!open) {
      closeReservationDialog();
      return;
    }

    setCreateDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingReservationId(null);
    setReservationForm(getDefaultReservationForm());
    setCreateDialogOpen(true);
  };

  const openEditDialog = (reservation: Reservation) => {
    setEditingReservationId(reservation.id);
    setReservationForm(getEditReservationForm(reservation));
    setSelectedEvent(null);
    setConfirmCancel(false);
    setCreateDialogOpen(true);
  };

  const handleSaveReservation = async () => {
    if (!reservationForm.date) {
      toast.error("Selecione uma data valida para a reserva.");
      return;
    }

    if (!reservationForm.roomId) {
      toast.error("Selecione uma sala para continuar.");
      return;
    }

    if (!reservationForm.startTime || !reservationForm.endTime) {
      toast.error("Selecione um horario inicial e final validos.");
      return;
    }

    setSavingReservation(true);

    try {
      const payload = {
        roomId: Number(reservationForm.roomId),
        personName: reservationForm.personName,
        date: reservationForm.date,
        startTime: reservationForm.startTime,
        endTime: reservationForm.endTime,
        meetingLink: reservationForm.meetingLink,
        participants: Number(reservationForm.participants),
      };

      const savedReservation = editingReservationId
        ? await api.client.updateReservation(editingReservationId, payload)
        : await api.client.createReservation(payload);

      setReservations((current) => {
        const nextReservations = editingReservationId
          ? current.map((reservation) => (reservation.id === savedReservation.id ? savedReservation : reservation))
          : [savedReservation, ...current];
        return sortReservations(nextReservations);
      });
      closeReservationDialog();
      toast.success(editingReservationId ? "Reserva atualizada com sucesso." : "Reserva criada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a reserva.");
    } finally {
      setSavingReservation(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedEventRefreshed) {
      return;
    }

    try {
      await api.client.cancelReservation(selectedEventRefreshed.id);
      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === selectedEventRefreshed.id
            ? {
                ...reservation,
                status: "cancelled",
                cancelledAt: new Date().toISOString().split("T")[0],
                cancelReason: "Cancelada pelo cliente via painel",
              }
            : reservation,
        ),
      );
      toast.success("Reserva cancelada com sucesso.");
      setConfirmCancel(false);
      setSelectedEvent(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel cancelar a reserva.");
    }
  };

  return (
    <Layout title="Agenda">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={roomFilter} onValueChange={setRoomFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filtrar por sala" />
              </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Salas</SelectItem>
                  {rooms.map((room) => (
                  <SelectItem key={room.id} value={String(room.id)}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrar por andar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Andares</SelectItem>
                {floors.map((floor) => (
                  <SelectItem key={floor} value={String(floor)}>
                    {floor}o Andar
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar responsavel..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9 w-56"
              />
            </div>
          </div>

          <Button
            onClick={openCreateDialog}
            disabled={loading || activeRooms.length === 0}
            className="syntra-gradient text-white"
          >
            <Plus className="h-4 w-4" />
            Nova Reserva
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
          <div className="syntra-card min-w-0 overflow-hidden p-5 lg:p-6">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              className="min-w-0 w-full rounded-xl"
              components={{
                DayContent: (dayContentProps) => (
                  <ReservationDayContent
                    {...dayContentProps}
                    dayIndicators={reservationIndicatorsByDate}
                  />
                ),
              }}
            />
          </div>

          <div className="min-w-0 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Reservas do Dia</h3>
            {loading ? (
              <div className="syntra-card p-8 text-center">
                <p className="text-muted-foreground">Carregando reservas...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="syntra-card p-8 text-center">
                <p className="text-muted-foreground">Nenhuma reserva para esta data.</p>
              </div>
            ) : (
              filtered.map((reservation) => (
                <motion.div
                  key={reservation.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="syntra-card-hover p-4 cursor-pointer"
                  onClick={() => setSelectedEvent(reservation)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-1 rounded-full" style={{ background: reservation.roomColor }} />
                      <div>
                        <p className="font-medium text-foreground">{reservation.roomName}</p>
                        <p className="text-sm text-muted-foreground">{reservation.personName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {reservation.startTime} - {reservation.endTime}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {reservation.participants}
                      </span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">
                        {getReservationSourceLabel(reservation.source)}
                      </Badge>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingReservationId ? "Editar Reserva" : "Nova Reserva"}</DialogTitle>
              <DialogDescription>
                {editingReservationId
                  ? `Atualize os dados da reserva para ${reservationFormDateLabel || selectedDateLabel}.`
                  : `Crie uma reserva para ${reservationFormDateLabel || selectedDateLabel}.`}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reservation-date">Data da reserva</Label>
                <Input
                  id="reservation-date"
                  type="date"
                  value={reservationForm.date}
                  onChange={(event) =>
                    setReservationForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
                {reservationFormDateLabel && (
                  <p className="text-xs text-muted-foreground">{reservationFormDateLabel}</p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reservation-room">Sala</Label>
                <Select
                  value={reservationForm.roomId}
                  onValueChange={(value) => setReservationForm((current) => ({ ...current, roomId: value }))}
                >
                  <SelectTrigger id="reservation-room">
                    <SelectValue placeholder="Selecione a sala" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoomsForForm.map((room) => (
                      <SelectItem key={room.id} value={String(room.id)}>
                        {room.name} - {room.floor}o andar - {room.capacity} pessoas
                        {room.status !== "active" ? " - Inativa" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedRoomForForm && (
                  <p className="text-xs text-muted-foreground">
                    Capacidade da sala: {selectedRoomForForm.capacity} participantes.
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reservation-person">Responsavel</Label>
                <Input
                  id="reservation-person"
                  value={reservationForm.personName}
                  onChange={(event) =>
                    setReservationForm((current) => ({ ...current, personName: event.target.value }))
                  }
                  placeholder="Nome de quem reservou"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reservation-meeting-link">Link da reuniao</Label>
                <Input
                  id="reservation-meeting-link"
                  value={reservationForm.meetingLink}
                  onChange={(event) =>
                    setReservationForm((current) => ({ ...current, meetingLink: event.target.value }))
                  }
                  placeholder="https://meet.exemplo.com/sua-reuniao"
                />
                <p className="text-xs text-muted-foreground">
                  Campo opcional. Pode ser um link de Google Meet, Zoom, Teams ou outro texto de acesso.
                </p>
              </div>

              <div className="space-y-3 sm:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>Faixa de horario</Label>
                  <span className="text-xs text-muted-foreground">
                    Disponivel de {settings.bookingStartTime} a {settings.bookingEndTime}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <Label htmlFor="reservation-start" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Horario inicial
                    </Label>
                    <Select
                      value={reservationForm.startTime}
                      onValueChange={(value) => {
                        const nextEndTime = timeOptions.find((option) => option > value) || "";
                        setReservationForm((current) => ({
                          ...current,
                          startTime: value,
                          endTime: current.endTime > value ? current.endTime : nextEndTime,
                        }));
                      }}
                    >
                      <SelectTrigger id="reservation-start" className="mt-2 h-12 border-0 bg-background/80 text-base shadow-none">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {startTimeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                    <Label htmlFor="reservation-end" className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Horario final
                    </Label>
                    <Select
                      value={reservationForm.endTime}
                      onValueChange={(value) => setReservationForm((current) => ({ ...current, endTime: value }))}
                    >
                      <SelectTrigger id="reservation-end" className="mt-2 h-12 border-0 bg-background/80 text-base shadow-none">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {endTimeOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!hasAvailableTimeRange && (
                  <p className="text-sm text-destructive">
                    Ajuste o horario de inicio e termino em Configuracoes para liberar horarios de reserva.
                  </p>
                )}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="reservation-participants">Participantes</Label>
                <Input
                  id="reservation-participants"
                  type="number"
                  min={1}
                  max={selectedRoomForForm?.capacity || undefined}
                  value={reservationForm.participants}
                  onChange={(event) =>
                    setReservationForm((current) => ({ ...current, participants: event.target.value }))
                  }
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => handleCreateDialogChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSaveReservation()}
                disabled={savingReservation || activeRooms.length === 0 || !hasAvailableTimeRange}
                className="syntra-gradient text-white"
              >
                {savingReservation ? "Salvando..." : editingReservationId ? "Salvar Alteracoes" : "Salvar Reserva"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet open={!!selectedEventRefreshed && !confirmCancel} onOpenChange={() => setSelectedEvent(null)}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Detalhes da Reserva</SheetTitle>
              <SheetDescription>
                Origem: {getReservationSourceLabel(selectedEventRefreshed?.source)}.
              </SheetDescription>
            </SheetHeader>
            {selectedEventRefreshed && (
              <div className="space-y-4 mt-6">
                <div className="syntra-card p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ background: selectedEventRefreshed.roomColor }} />
                    <span className="font-medium">{selectedEventRefreshed.roomName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Andar</span>
                      <p>{selectedEventRefreshed.floor || "-"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Responsavel</span>
                      <p>{selectedEventRefreshed.personName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Participantes</span>
                      <p>{selectedEventRefreshed.participants}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Horario</span>
                      <p>
                        {selectedEventRefreshed.startTime} - {selectedEventRefreshed.endTime}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Origem</span>
                      <p>{getReservationSourceLabel(selectedEventRefreshed.source)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <p>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                          Confirmada
                        </Badge>
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Link da reuniao</span>
                      {selectedEventRefreshed.meetingLink ? (
                        /^https?:\/\//i.test(selectedEventRefreshed.meetingLink) ? (
                          <p className="mt-1 break-all">
                            <a
                              href={selectedEventRefreshed.meetingLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {selectedEventRefreshed.meetingLink}
                            </a>
                          </p>
                        ) : (
                          <p className="mt-1 break-all">{selectedEventRefreshed.meetingLink}</p>
                        )
                      ) : (
                        <p>-</p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" className="w-full" onClick={() => openEditDialog(selectedEventRefreshed)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar Reserva
                  </Button>
                  <Button variant="destructive" className="w-full" onClick={() => setConfirmCancel(true)}>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar Reserva
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Cancelamento</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja cancelar esta reserva? Esta acao nao pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmCancel(false)}>
                Voltar
              </Button>
              <Button variant="destructive" onClick={handleCancel}>
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </motion.div>
    </Layout>
  );
}
