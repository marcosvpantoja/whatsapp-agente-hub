import { useEffect, useMemo, useState } from "react";
import { Eye, Plus, Search, Wifi, WifiOff } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { User } from "@/lib/mockData";
import { Layout } from "@/components/Layout";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

export default function MasterClients() {
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [credentialsDialog, setCredentialsDialog] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", company: "", agentName: "" });
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadClients = async () => {
      try {
        const data = await api.master.clients();
        if (active) {
          setClients(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar os clientes.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadClients();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      clients.filter(
        (client) =>
          client.name.toLowerCase().includes(search.toLowerCase()) ||
          client.company.toLowerCase().includes(search.toLowerCase()) ||
          client.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [clients, search],
  );

  const handleCreate = async () => {
    try {
      const response = await api.master.createClient(form);
      setClients((current) => [response.client, ...current]);
      setDialogOpen(false);
      setForm({ name: "", email: "", company: "", agentName: "" });
      setNewCredentials({ email: response.client.email, password: response.temporaryPassword });
      setCredentialsDialog(true);
      toast.success("Cliente criado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel criar o cliente.");
    }
  };

  return (
    <Layout title="Clientes">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9 w-72"
            />
          </div>
          <Button onClick={() => setDialogOpen(true)} className="syntra-gradient text-white gap-2">
            <Plus className="h-4 w-4" />
            Novo Cliente
          </Button>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="syntra-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Agente</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.name}</TableCell>
                  <TableCell>{client.company}</TableCell>
                  <TableCell className="text-muted-foreground">{client.email}</TableCell>
                  <TableCell className="text-muted-foreground">{client.agentName || "-"}</TableCell>
                  <TableCell>
                    {client.whatsappConnected ? (
                      <Wifi className="h-4 w-4 text-green-600" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={client.status === "active" ? "secondary" : "destructive"}
                      className={
                        client.status === "active"
                          ? "bg-green-100 text-green-700 border-0 text-xs"
                          : client.status === "inactive"
                            ? "bg-muted text-muted-foreground border-0 text-xs"
                            : "text-xs"
                      }
                    >
                      {client.status === "active" ? "Ativo" : client.status === "inactive" ? "Inativo" : "Bloqueado"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{client.createdAt}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/master/clientes/${client.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum cliente encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </motion.div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input
                value={form.company}
                onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nome do Agente</Label>
              <Input
                value={form.agentName}
                onChange={(event) => setForm((current) => ({ ...current, agentName: event.target.value }))}
                placeholder="Ex: Agente MinhaCo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} className="syntra-gradient text-white">
              Criar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={credentialsDialog} onOpenChange={setCredentialsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credenciais Temporarias</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>Guarde estas credenciais e compartilhe com o cliente em canal seguro.</p>
            <p className="text-muted-foreground">No primeiro login, o cliente sera obrigado a definir uma nova senha.</p>
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-2">
              <p>
                <strong>E-mail:</strong> {newCredentials?.email}
              </p>
              <p>
                <strong>Senha temporaria:</strong> {newCredentials?.password}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentialsDialog(false)} className="syntra-gradient text-white">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
