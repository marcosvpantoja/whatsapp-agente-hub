import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Building,
  Calendar,
  CalendarCheck,
  Clock,
  DoorOpen,
  Mail,
  Pencil,
  RefreshCw,
  Shield,
  ShieldOff,
  User,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { api, type ClientProfileData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ticketStatus: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  open: { label: "Aberto", variant: "destructive" },
  in_progress: { label: "Em andamento", variant: "default" },
  resolved: { label: "Resolvido", variant: "secondary" },
};

function getReservationSourceLabel(source?: ClientProfileData["reservations"][number]["source"]) {
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

export default function ClientProfile() {
  const { clientId = "" } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ClientProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordDialog, setPasswordDialog] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    company: "",
    agentName: "",
    whatsappNumber: "",
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        const data = await api.master.clientProfile(clientId);
        if (active) {
          setProfile(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o perfil do cliente.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (clientId) {
      void loadProfile();
    }

    return () => {
      active = false;
    };
  }, [clientId]);

  const today = new Date().toISOString().split("T")[0];
  const todayReservations = useMemo(
    () => profile?.reservations.filter((reservation) => reservation.date === today && reservation.status === "confirmed") || [],
    [profile, today],
  );
  const cancelledReservations = profile?.reservations.filter((reservation) => reservation.status === "cancelled") || [];
  const recentReservations = profile?.reservations.filter((reservation) => reservation.status !== "cancelled").slice(0, 6) || [];

  useEffect(() => {
    if (!profile) {
      return;
    }

    setEditForm({
      name: profile.client.name,
      email: profile.client.email,
      company: profile.client.company,
      agentName: profile.client.agentName || "",
      whatsappNumber: profile.client.whatsappNumber || profile.whatsapp.phoneNumber || "",
    });
  }, [profile]);

  const handleStatusToggle = async () => {
    if (!profile) {
      return;
    }

    const nextStatus = profile.client.status === "active" ? "blocked" : "active";
    try {
      const updated = await api.master.updateClientStatus(profile.client.id, nextStatus);
      setProfile({ ...profile, client: updated });
      toast.success(nextStatus === "active" ? "Acesso liberado." : "Acesso bloqueado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel alterar o status.");
    }
  };

  const handleResetPassword = async () => {
    if (!profile) {
      return;
    }

    try {
      const response = await api.master.resetClientPassword(profile.client.id);
      setPasswordDialog(response.temporaryPassword);
      toast.success("Senha temporaria gerada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel redefinir a senha.");
    }
  };

  const handleSaveClient = async () => {
    if (!profile) {
      return;
    }

    setSavingEdit(true);
    try {
      const updatedProfile = await api.master.updateClient(profile.client.id, editForm);
      setProfile(updatedProfile);
      setEditDialogOpen(false);
      toast.success("Dados do cliente atualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o cliente.");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <Layout title="Perfil do Cliente">
        <div className="text-center py-20 text-muted-foreground">Carregando perfil...</div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout title="Cliente nao encontrado">
        <div className="text-center py-20">
          <p className="text-muted-foreground">Cliente nao encontrado.</p>
          <Button variant="ghost" className="mt-4" onClick={() => navigate("/master/clientes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={`Perfil: ${profile.client.name}`}>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/master/clientes")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="syntra-card lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Dados do Cliente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem icon={User} label="Nome" value={profile.client.name} />
                <InfoItem icon={Mail} label="E-mail" value={profile.client.email} />
                <InfoItem icon={Building} label="Empresa" value={profile.client.company} />
                <InfoItem icon={Bot} label="Agente" value={profile.client.agentName || "-"} />
                <div className="flex items-start gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status da conta</p>
                    <Badge className="text-xs mt-0.5">
                      {profile.client.status === "active"
                        ? "Ativo"
                        : profile.client.status === "inactive"
                          ? "Inativo"
                          : "Bloqueado"}
                    </Badge>
                  </div>
                </div>
                <InfoItem icon={Calendar} label="Criado em" value={profile.client.createdAt} />
                <InfoItem icon={Clock} label="Ultimo acesso" value={profile.client.lastLogin || "-"} />
                <div className="flex items-start gap-3">
                  {profile.client.whatsappConnected ? (
                    <Wifi className="h-4 w-4 text-[hsl(var(--success))] mt-0.5" />
                  ) : (
                    <WifiOff className="h-4 w-4 text-destructive mt-0.5" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="text-sm text-foreground">
                      {profile.client.whatsappConnected
                        ? `Conectado (${profile.client.whatsappNumber || "numero nao informado"})`
                        : "Desconectado"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="syntra-card">
            <CardHeader>
              <CardTitle className="text-lg">Acoes de Suporte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => setEditDialogOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar Dados
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => void handleResetPassword()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Resetar Senha
              </Button>
              <Button
                variant="outline"
                className={`w-full justify-start ${
                  profile.client.status === "active" ? "text-destructive border-destructive/30" : "text-[hsl(var(--success))]"
                }`}
                onClick={() => void handleStatusToggle()}
              >
                {profile.client.status === "active" ? (
                  <>
                    <ShieldOff className="h-4 w-4 mr-2" />
                    Bloquear Acesso
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Liberar Acesso
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="rooms">Salas</TabsTrigger>
            <TabsTrigger value="reservations">Reservas</TabsTrigger>
            <TabsTrigger value="tickets">Chamados</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MiniMetric label="Salas Cadastradas" value={profile.rooms.length} icon={DoorOpen} />
              <MiniMetric label="Reservas Hoje" value={todayReservations.length} icon={CalendarCheck} />
              <MiniMetric label="Canceladas" value={cancelledReservations.length} icon={XCircle} />
            </div>
          </TabsContent>

          <TabsContent value="rooms">
            <Card className="syntra-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Andar</TableHead>
                      <TableHead>Capacidade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.rooms.map((room) => (
                      <TableRow key={room.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: room.color }} />
                            {room.name}
                          </div>
                        </TableCell>
                        <TableCell>{room.floor}o</TableCell>
                        <TableCell>{room.capacity}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${room.status === "active" ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]" : "bg-muted text-muted-foreground"}`}>
                            {room.status === "active" ? "Ativa" : "Inativa"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reservations">
            <div className="space-y-4">
              <Card className="syntra-card">
                <CardHeader>
                  <CardTitle className="text-base">Reservas Recentes</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sala</TableHead>
                        <TableHead>Responsavel</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Horario</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentReservations.map((reservation) => (
                        <TableRow key={reservation.id}>
                          <TableCell className="font-medium">{reservation.roomName}</TableCell>
                          <TableCell>{reservation.personName}</TableCell>
                          <TableCell className="text-muted-foreground">{reservation.date}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {reservation.startTime}-{reservation.endTime}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                              {getReservationSourceLabel(reservation.source)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {cancelledReservations.length > 0 && (
                <Card className="syntra-card">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Canceladas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Sala</TableHead>
                          <TableHead>Responsavel</TableHead>
                          <TableHead>Data Cancel.</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cancelledReservations.map((reservation) => (
                          <TableRow key={reservation.id}>
                            <TableCell>{reservation.roomName}</TableCell>
                            <TableCell>{reservation.personName}</TableCell>
                            <TableCell className="text-muted-foreground">{reservation.cancelledAt}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{reservation.cancelReason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tickets">
            <Card className="syntra-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Titulo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aberto em</TableHead>
                      <TableHead>Atualizado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.tickets.map((ticket) => (
                      <TableRow key={ticket.id}>
                        <TableCell className="font-medium">{ticket.title}</TableCell>
                        <TableCell>
                          <Badge variant={ticketStatus[ticket.status]?.variant} className="text-xs">
                            {ticketStatus[ticket.status]?.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{ticket.createdAt}</TableCell>
                        <TableCell className="text-muted-foreground">{ticket.updatedAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!passwordDialog} onOpenChange={() => setPasswordDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha Temporaria</DialogTitle>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p>Compartilhe a senha abaixo com o cliente em canal seguro:</p>
            <p className="mt-3 font-semibold">{passwordDialog}</p>
            <p className="mt-3 text-muted-foreground">
              No proximo login, o cliente precisara trocar essa senha antes de acessar o sistema.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setPasswordDialog(null)} className="syntra-gradient text-white">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={editForm.company} onChange={(event) => setEditForm((current) => ({ ...current, company: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input value={editForm.agentName} onChange={(event) => setEditForm((current) => ({ ...current, agentName: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Numero do WhatsApp</Label>
              <Input
                value={editForm.whatsappNumber}
                onChange={(event) => setEditForm((current) => ({ ...current, whatsappNumber: event.target.value }))}
                placeholder="+55 11 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSaveClient()} disabled={savingEdit} className="syntra-gradient text-white">
              {savingEdit ? "Salvando..." : "Salvar Alteracoes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        </div>
        <Icon className="h-6 w-6 text-primary opacity-70" />
      </div>
    </div>
  );
}
