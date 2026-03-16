import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import syntraLogo from "@/assets/syntra-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      const user = await login(email, password);
      navigate(user.mustChangePassword ? "/primeiro-acesso" : user.role === "master" ? "/master" : "/", { replace: true });
      toast.success("Login realizado com sucesso!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credenciais inválidas.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center syntra-gradient-dark p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="glassmorphism p-8 space-y-8">
          <div className="flex flex-col items-center gap-4">
            <img src={syntraLogo} alt="Syntra Spaces" className="h-16 w-16 rounded-full" />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">Syntra Spaces</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gerenciamento inteligente de salas de reunião
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="bg-muted/50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="bg-muted/50"
              />
            </div>

            <Button
              type="submit"
              className="w-full syntra-gradient-accent text-primary-foreground hover:opacity-90 font-semibold"
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
            <p className="pt-3">Use as credenciais cadastradas no banco de dados.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
