import { useEffect, useMemo, useState } from "react";
import { Building, Clock, Eye, Mail, MessageSquare, Paperclip, Search, Send, TicketCheck, User } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { api, type SupportUser } from "@/lib/api";
import type { Ticket } from "@/lib/mockData";
import { filesToAttachmentPayload } from "@/lib/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const statusMap: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  open: { label: "Aberto", variant: "destructive" },
  in_progress: { label: "Em andamento", variant: "default" },
  resolved: { label: "Resolvido", variant: "secondary" },
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function MasterTickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [supportUsers, setSupportUsers] = useState<SupportUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newNote, setNewNote] = useState("");
  const [newNoteInternal, setNewNoteInternal] = useState(false);
  const [noteFiles, setNoteFiles] = useState<File[]>([]);
  const [savingAssignment, setSavingAssignment] = useState(false);

  const loadTickets = async (nextSearch = "", nextStatus = "all") => {
    try {
      const [ticketsData, supportUsersData] = await Promise.all([
        api.master.tickets(nextSearch, nextStatus),
        api.master.supportUsers(),
      ]);
      setTickets(ticketsData);
      setSupportUsers(supportUsersData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar os chamados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTickets(search, statusFilter);
  }, [search, statusFilter]);

  const selectedTicketRefreshed = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicket?.id) || selectedTicket,
    [tickets, selectedTicket],
  );

  const handleChangeStatus = async (newStatus: string) => {
    if (!selectedTicketRefreshed) {
      return;
    }

    try {
      await api.master.updateTicketStatus(
        selectedTicketRefreshed.id,
        newStatus as "open" | "in_progress" | "resolved",
      );
      await loadTickets(search, statusFilter);
      toast.success(`Status alterado para "${statusMap[newStatus]?.label}".`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel alterar o status.");
    }
  };

  const handleAddNote = async () => {
    if (!selectedTicketRefreshed || !newNote.trim()) {
      return;
    }

    try {
      const attachments = noteFiles.length > 0 ? await filesToAttachmentPayload(noteFiles) : [];
      const updatedTicket = await api.master.addTicketNote(selectedTicketRefreshed.id, {
        text: newNote,
        internal: newNoteInternal,
        attachments,
      });
      setNewNote("");
      setNewNoteInternal(false);
      setNoteFiles([]);
      setTickets((current) => current.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
      setSelectedTicket(updatedTicket);
      toast.success(newNoteInternal ? "Observacao interna adicionada." : "Resposta enviada ao cliente.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel adicionar a observacao.");
    }
  };

  const handleAssign = async (assignedToUserId: string) => {
    if (!selectedTicketRefreshed) {
      return;
    }

    setSavingAssignment(true);

    try {
      const updatedTicket = await api.master.assignTicket(
        selectedTicketRefreshed.id,
        assignedToUserId === "unassigned" ? null : assignedToUserId,
      );
      setTickets((current) => current.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
      setSelectedTicket(updatedTicket);
      toast.success("Responsavel atualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar o responsavel.");
    } finally {
      setSavingAssignment(false);
    }
  };

  return (
    <Layout title="Chamados">
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar chamado..."
              className="pl-9 bg-muted/50"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberto</SelectItem>
              <SelectItem value="in_progress">Em andamento</SelectItem>
              <SelectItem value="resolved">Resolvido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="syntra-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Abertura</TableHead>
                  <TableHead>Atualizacao</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell className="text-sm font-medium">{ticket.clientName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.company}</TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[200px]">{ticket.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusMap[ticket.status]?.variant} className="text-xs">
                        {statusMap[ticket.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.createdAt}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.updatedAt}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.assignedTo || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedTicket(ticket)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum chamado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={!!selectedTicketRefreshed}
        onOpenChange={() => {
          setSelectedTicket(null);
          setNewNote("");
          setNewNoteInternal(false);
          setNoteFiles([]);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TicketCheck className="h-5 w-5 text-primary" />
              {selectedTicketRefreshed?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedTicketRefreshed && (
            <div className="space-y-5">
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50 grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  {selectedTicketRefreshed.clientName}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  {selectedTicketRefreshed.company}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  {selectedTicketRefreshed.email}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant={statusMap[selectedTicketRefreshed.status]?.variant} className="text-xs">
                    {statusMap[selectedTicketRefreshed.status]?.label}
                  </Badge>
                </div>
              </div>

              <div className="bg-muted/20 rounded-lg p-4 border border-border/30">
                <p className="text-sm text-foreground">{selectedTicketRefreshed.description}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm">Alterar status</Label>
                  <Select
                    value={selectedTicketRefreshed.status}
                    onValueChange={(value) => void handleChangeStatus(value)}
                  >
                    <SelectTrigger className="h-10 bg-muted/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Aberto</SelectItem>
                      <SelectItem value="in_progress">Em andamento</SelectItem>
                      <SelectItem value="resolved">Resolvido</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Responsavel</Label>
                  <Select
                    value={selectedTicketRefreshed.assignedToId ?? "unassigned"}
                    onValueChange={(value) => void handleAssign(value)}
                    disabled={savingAssignment}
                  >
                    <SelectTrigger className="h-10 bg-muted/50">
                      <SelectValue placeholder="Selecione um responsavel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sem responsavel</SelectItem>
                      {supportUsers.map((supportUser) => (
                        <SelectItem key={supportUser.id} value={supportUser.id}>
                          {supportUser.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Historico
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {selectedTicketRefreshed.notes?.map((note) => (
                    <div
                      key={note.id}
                      className={`rounded-lg p-3 border ${note.internal ? "bg-primary/5 border-primary/20" : "bg-muted/20 border-border/30"}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">
                          {note.author}
                          {note.internal && (
                            <Badge variant="outline" className="text-[10px] ml-1">
                              Interno
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {note.createdAt}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{note.text}</p>
                      {note.attachments && note.attachments.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {note.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.downloadUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between rounded-lg border border-border/40 bg-background/70 px-3 py-2 text-sm hover:bg-background"
                            >
                              <span className="flex items-center gap-2 text-foreground">
                                <Paperclip className="h-4 w-4 text-primary" />
                                {attachment.fileName}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-2">
                    <Label className="text-sm">Tipo da mensagem</Label>
                    <Select
                      value={newNoteInternal ? "internal" : "public"}
                      onValueChange={(value) => setNewNoteInternal(value === "internal")}
                    >
                      <SelectTrigger className="h-10 bg-muted/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Resposta ao cliente</SelectItem>
                        <SelectItem value="internal">Observacao interna</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Anexos</Label>
                    <Input
                      type="file"
                      multiple
                      onChange={(event) => setNoteFiles(Array.from(event.target.files || []))}
                      className="bg-muted/50"
                    />
                  </div>
                </div>

                <Textarea
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder={newNoteInternal ? "Escreva uma observacao interna..." : "Escreva uma resposta ao cliente..."}
                  rows={3}
                  className="bg-muted/50"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {noteFiles.length > 0 ? `${noteFiles.length} anexo(s) selecionado(s).` : "Sem anexos."}
                  </p>
                  <Button
                    onClick={() => void handleAddNote()}
                    size="sm"
                    disabled={!newNote.trim()}
                    className="syntra-gradient-accent text-primary-foreground"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {newNoteInternal ? "Salvar observacao" : "Responder cliente"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
