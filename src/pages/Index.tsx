import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Clock, DoorClosed, DoorOpen, Users } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api, type DashboardData } from "@/lib/api";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const icons = [DoorOpen, DoorClosed, CheckCircle];

function getReservationSourceLabel(source?: DashboardData["confirmedReservations"][number]["source"]) {
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

export default function Index() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const data = await api.client.dashboard();
        if (active) {
          setDashboard(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o dashboard.");
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
    <Layout title="Dashboard">
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(dashboard?.metrics || []).map((metric, index) => {
            const Icon = icons[index] || DoorOpen;
            const accent = index === 0;

            return (
              <motion.div
                key={metric.label}
                variants={item}
                className={`metric-card ${accent ? "purple-glow border-primary/20" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">
                      {loading ? "--" : metric.value}
                    </p>
                  </div>
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center ${
                      accent ? "syntra-gradient text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div variants={item} className="syntra-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Salas Ocupadas Hoje</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : dashboard && dashboard.confirmedReservations.length > 0 ? (
            <div className="space-y-3">
              {dashboard.confirmedReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full" style={{ background: reservation.roomColor }} />
                    <div>
                      <p className="font-medium text-sm text-foreground">{reservation.roomName}</p>
                      <p className="text-xs text-muted-foreground">{reservation.personName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {reservation.startTime}-{reservation.endTime}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {reservation.participants}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma reserva confirmada para hoje.</p>
          )}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div variants={item} className="syntra-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Ultimas Reservas</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sala</TableHead>
                  <TableHead>Responsavel</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Participantes</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard?.confirmedReservations || []).map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: reservation.roomColor }} />
                        {reservation.roomName}
                      </div>
                    </TableCell>
                    <TableCell>{reservation.personName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {reservation.startTime}-{reservation.endTime}
                    </TableCell>
                    <TableCell>{reservation.participants}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">
                        {getReservationSourceLabel(reservation.source)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && (dashboard?.confirmedReservations.length || 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhuma reserva confirmada hoje.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </motion.div>

          <motion.div variants={item} className="syntra-card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Reservas Canceladas</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : dashboard && dashboard.cancelledReservations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sala</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.cancelledReservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full" style={{ background: reservation.roomColor }} />
                          {reservation.roomName}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {reservation.startTime}-{reservation.endTime}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{reservation.cancelReason || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-xs">
                          Cancelada
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum cancelamento registrado.</p>
            )}
          </motion.div>
        </div>
      </motion.div>
    </Layout>
  );
}
