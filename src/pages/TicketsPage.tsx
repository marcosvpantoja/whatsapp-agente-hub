import { useEffect, useMemo, useState } from "react";
import { Clock, MessageSquare, Paperclip, Plus, Send, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { Ticket } from "@/lib/mockData";
import { filesToAttachmentPayload } from "@/lib/files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export default function TicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [form, setForm] = useState({ title: "", description: "" });
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    let active = true;

    const loadTickets = async () => {
      try {
        const data = await api.client.tickets();
        if (active) {
          setTickets(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar os chamados.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadTickets();

    return () => {
      active = false;
    };
  }, []);

  const selectedTicketRefreshed = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicket?.id) || selectedTicket,
    [tickets, selectedTicket],
  );

  const handleCreate = async () => {
    try {
      const attachments = createFiles.length > 0 ? await filesToAttachmentPayload(createFiles) : [];
      const created = await api.client.createTicket({ ...form, attachments });
      setTickets((current) => [created, ...current]);
      setForm({ title: "", description: "" });
      setCreateFiles([]);
      setShowCreate(false);
      toast.success("Chamado aberto com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel abrir o chamado.");
    }
  };

  const handleReply = async () => {
    if (!selectedTicketRefreshed || !replyText.trim()) {
      return;
    }

    setSubmittingReply(true);

    try {
      const attachments = replyFiles.length > 0 ? await filesToAttachmentPayload(replyFiles) : [];
      const updatedTicket = await api.client.addTicketNote(selectedTicketRefreshed.id, {
        text: replyText,
        attachments,
      });

      setTickets((current) => current.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
      setSelectedTicket(updatedTicket);
      setReplyText("");
      setReplyFiles([]);
      toast.success("Resposta enviada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel enviar a resposta.");
    } finally {
      setSubmittingReply(false);
    }
  };

  return (
    <Layout title="Chamados">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {loading ? "Carregando..." : `${tickets.length} chamados`}
          </p>
          <Button onClick={() => setShowCreate(true)} className="syntra-gradient-accent text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            Abrir Chamado
          </Button>
        </div>

        <Card className="syntra-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data de Abertura</TableHead>
                  <TableHead>Ultima Atualizacao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((ticket) => (
                  <TableRow
                    key={ticket.id}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <TableCell className="font-medium">{ticket.title}</TableCell>
                    <TableCell>
                      <Badge variant={statusMap[ticket.status]?.variant} className="text-xs">
                        {statusMap[ticket.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.createdAt}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ticket.updatedAt}</TableCell>
                  </TableRow>
                ))}
                {!loading && tickets.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum chamado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Novo Chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={user?.email || ""} disabled className="bg-muted/50 opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Titulo</Label>
              <Input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Resumo do problema..."
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Descricao</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Descreva o problema em detalhes..."
                rows={4}
                className="bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Anexos</Label>
              <Input
                type="file"
                multiple
                onChange={(event) => setCreateFiles(Array.from(event.target.files || []))}
                className="bg-muted/50"
              />
              {createFiles.length > 0 && (
                <p className="text-xs text-muted-foreground">{createFiles.length} anexo(s) selecionado(s).</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} className="syntra-gradient-accent text-primary-foreground">
              Enviar Chamado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!selectedTicketRefreshed}
        onOpenChange={() => {
          setSelectedTicket(null);
          setReplyText("");
          setReplyFiles([]);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TicketCheck className="h-5 w-5 text-primary" />
              {selectedTicketRefreshed?.title}
            </DialogTitle>
          </DialogHeader>
          {selectedTicketRefreshed && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={statusMap[selectedTicketRefreshed.status]?.variant} className="text-xs">
                  {statusMap[selectedTicketRefreshed.status]?.label}
                </Badge>
                <span className="text-xs text-muted-foreground">Aberto em {selectedTicketRefreshed.createdAt}</span>
              </div>
              <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
                <p className="text-sm text-foreground">{selectedTicketRefreshed.description}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Historico
                </h4>
                <div className="space-y-2">
                  {selectedTicketRefreshed.notes?.map((note) => (
                    <div key={note.id} className="bg-muted/20 rounded-lg p-3 border border-border/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{note.author}</span>
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
                <Label>Responder chamado</Label>
                <Textarea
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                  placeholder="Escreva sua resposta..."
                  rows={3}
                  className="bg-muted/50"
                />
                <Input
                  type="file"
                  multiple
                  onChange={(event) => setReplyFiles(Array.from(event.target.files || []))}
                  className="bg-muted/50"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {replyFiles.length > 0 ? `${replyFiles.length} anexo(s) selecionado(s).` : "Sem anexos."}
                  </p>
                  <Button
                    onClick={() => void handleReply()}
                    disabled={submittingReply || !replyText.trim()}
                    className="syntra-gradient-accent text-primary-foreground"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submittingReply ? "Enviando..." : "Responder"}
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
