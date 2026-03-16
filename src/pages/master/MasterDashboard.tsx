import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, TicketCheck, TrendingUp, Users, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { api, type MasterDashboardData } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const iconMap = [Users, TicketCheck, Bot, WifiOff];

const statusMap: Record<string, { label: string; variant: "destructive" | "default" | "secondary" }> = {
  open: { label: "Aberto", variant: "destructive" },
  in_progress: { label: "Em andamento", variant: "default" },
  resolved: { label: "Resolvido", variant: "secondary" },
};

export default function MasterDashboard() {
  const [dashboard, setDashboard] = useState<MasterDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const data = await api.master.dashboard();
        if (active) {
          setDashboard(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o dashboard master.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Layout title="Dashboard Master">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(dashboard?.metrics || []).map((metric, index) => {
            const Icon = iconMap[index] || Users;
            return (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
              >
                <div className="metric-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.label}</p>
                      <p className="text-3xl font-bold text-foreground mt-1">
                        {loading ? "--" : metric.value}
                      </p>
                    </div>
                    <Icon className="h-8 w-8 text-primary opacity-80" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="syntra-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Ultimos Clientes Cadastrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.recentClients || []).map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="text-sm font-medium">{client.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{client.company}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{client.createdAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="syntra-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TicketCheck className="h-5 w-5 text-primary" />
                Chamados Recentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dashboard?.recentTickets || []).map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="text-sm">{ticket.clientName}</TableCell>
                      <TableCell className="text-sm font-medium truncate max-w-[200px]">{ticket.title}</TableCell>
                      <TableCell>
                        <Badge variant={statusMap[ticket.status]?.variant} className="text-xs">
                          {statusMap[ticket.status]?.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="syntra-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Clientes com Mais Reservas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(dashboard?.topClients || []).map((client, index) => (
                <div key={client.id} className="flex items-center gap-4">
                  <span className="text-lg font-bold text-muted-foreground w-6 text-right">{index + 1}</span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-foreground">{client.company}</span>
                      <span className="text-sm text-muted-foreground">{client.reservations} reservas</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full syntra-gradient-accent rounded-full"
                        style={{ width: `${Math.min((client.reservations / 40) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
