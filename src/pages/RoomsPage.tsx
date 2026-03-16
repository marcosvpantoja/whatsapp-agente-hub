import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { Room } from "@/lib/mockData";
import { api } from "@/lib/api";

const initialForm = {
  name: "",
  floor: "1",
  capacity: "4",
  description: "",
  color: "#7C3AED",
  active: true,
};

export default function RoomsPage() {
  const [roomsList, setRoomsList] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [floorFilter, setFloorFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    let active = true;

    const loadRooms = async () => {
      try {
        const data = await api.client.rooms();
        if (active) {
          setRoomsList(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as salas.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRooms();

    return () => {
      active = false;
    };
  }, []);

  const floors = useMemo(
    () => [...new Set(roomsList.map((room) => room.floor))].sort((a, b) => a - b),
    [roomsList],
  );

  const filtered = useMemo(
    () =>
      roomsList.filter(
        (room) =>
          room.name.toLowerCase().includes(search.toLowerCase()) &&
          (floorFilter === "all" || room.floor === Number(floorFilter)),
      ),
    [roomsList, search, floorFilter],
  );

  const openAdd = () => {
    setEditing(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (room: Room) => {
    setEditing(room);
    setForm({
      name: room.name,
      floor: String(room.floor),
      capacity: String(room.capacity),
      description: room.description,
      color: room.color,
      active: room.status === "active",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (room: Room) => {
    try {
      await api.client.deleteRoom(room.id);
      setRoomsList((current) => current.filter((item) => item.id !== room.id));
      toast.success("Sala removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel remover a sala.");
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        name: form.name,
        floor: Number(form.floor),
        capacity: Number(form.capacity),
        description: form.description,
        color: form.color,
        active: form.active,
      };

      const savedRoom = editing
        ? await api.client.updateRoom(editing.id, payload)
        : await api.client.createRoom(payload);

      setRoomsList((current) =>
        editing
          ? current.map((room) => (room.id === editing.id ? savedRoom : room))
          : [...current, savedRoom],
      );

      toast.success(editing ? "Sala atualizada." : "Sala cadastrada.");
      setDialogOpen(false);
      setEditing(null);
      setForm(initialForm);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar a sala.");
    }
  };

  return (
    <Layout title="Salas">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar salas..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9 w-64"
              />
            </div>

            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Andar" />
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
          </div>

          <Button onClick={openAdd} className="syntra-gradient text-white gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Sala
          </Button>
        </div>

        <div className="syntra-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Andar</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium">{room.name}</TableCell>
                  <TableCell>{room.floor}o</TableCell>
                  <TableCell>{room.capacity} pessoas</TableCell>
                  <TableCell>
                    <Badge
                      variant={room.status === "active" ? "secondary" : "destructive"}
                      className={room.status === "active" ? "bg-green-100 text-green-700 border-0" : ""}
                    >
                      {room.status === "active" ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="h-5 w-5 rounded-full border border-border" style={{ background: room.color }} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(room)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma sala encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Sala" : "Cadastrar Sala"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label>Nome da Sala</Label>
                <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Andar</Label>
                  <Input
                    type="number"
                    value={form.floor}
                    onChange={(event) => setForm({ ...form, floor: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Capacidade</Label>
                  <Input
                    type="number"
                    value={form.capacity}
                    onChange={(event) => setForm({ ...form, capacity: event.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descricao</Label>
                <Textarea
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </div>

              <div className="flex items-center gap-4">
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(event) => setForm({ ...form, color: event.target.value })}
                    className="h-10 w-14 rounded cursor-pointer bg-transparent border border-border"
                  />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <Switch checked={form.active} onCheckedChange={(value) => setForm({ ...form, active: value })} />
                  <Label>{form.active ? "Ativa" : "Inativa"}</Label>
                </div>
              </div>

              <Button onClick={() => void handleSave()} className="w-full syntra-gradient text-white">
                {editing ? "Salvar Alteracoes" : "Cadastrar Sala"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </Layout>
  );
}
