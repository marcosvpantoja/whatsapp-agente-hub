import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import syntraLogo from "@/assets/syntra-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForcePasswordChangePage() {
  const navigate = useNavigate();
  const { changePassword, role, user } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await changePassword({
        newPassword,
        confirmPassword,
      });

      toast.success("Senha definida com sucesso.");
      navigate(role === "master" ? "/master" : "/", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center syntra-gradient-dark p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="glassmorphism p-8 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <img src={syntraLogo} alt="Syntra Spaces" className="h-16 w-16 rounded-full" />
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-foreground">Primeiro Acesso</h1>
              <p className="text-sm text-muted-foreground">
                {user?.name || "Usuario"}, defina agora a sua senha pessoal para continuar.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Minimo de 8 caracteres"
                required
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repita a nova senha"
                required
                className="bg-muted/50"
              />
            </div>

            <Button
              type="submit"
              disabled={saving}
              className="w-full syntra-gradient-accent text-primary-foreground hover:opacity-90 font-semibold"
            >
              {saving ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
