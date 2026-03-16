import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { api, type SettingsData } from "@/lib/api";
import { buildTimeOptions } from "@/lib/time";

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

export default function SettingsPage() {
  const { changePassword, refreshUser } = useAuth();
  const { setTheme } = useTheme();
  const [settings, setSettings] = useState<SettingsData>(fallbackSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const smtpDisabled = loading || !settings.emailEnabled;
  const ruleTimeOptions = buildTimeOptions("00:00", "23:30");
  const bookingStartOptions = ruleTimeOptions.slice(0, -1);
  const bookingEndOptions = ruleTimeOptions.filter((option) => option > settings.bookingStartTime);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const data = await api.client.settings();
        if (active) {
          setSettings(data);
        }
      } catch (error) {
        if (active) {
          toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar as configuracoes.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await api.client.updateSettings(settings);
      setSettings(saved);
      setTheme(saved.themePreference);
      void refreshUser();
      toast.success("Configuracoes salvas.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel salvar as configuracoes.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    setChangingPassword(true);

    try {
      await changePassword(passwordForm);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast.success("Senha atualizada com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel atualizar a senha.");
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <Layout title="Configuracoes">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-4">
        <div className="syntra-card overflow-hidden">
          <Accordion type="multiple" defaultValue={[]} className="w-full">
            <AccordionItem value="general" className="border-border px-5">
              <AccordionTrigger className="text-foreground hover:no-underline">Geral</AccordionTrigger>
              <AccordionContent className="space-y-4 pb-5">
                <div className="space-y-2">
                  <Label>Nome do Sistema</Label>
                  <Input
                    disabled={loading}
                    value={settings.systemName}
                    onChange={(event) => setSettings({ ...settings, systemName: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fuso Horario</Label>
                  <Select
                    value={settings.timezone}
                    onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                      <SelectItem value="America/Manaus">America/Manaus</SelectItem>
                      <SelectItem value="America/Belem">America/Belem</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select
                    value={settings.themePreference}
                    onValueChange={(value: SettingsData["themePreference"]) =>
                      setSettings({ ...settings, themePreference: value })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rules" className="border-border px-5">
              <AccordionTrigger className="text-foreground hover:no-underline">
                Regras de Reserva
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Faixa de horario</Label>
                    <span className="text-xs text-muted-foreground">
                      Intervalos de 30 minutos
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Horario de Inicio
                      </Label>
                      <Select
                        value={settings.bookingStartTime}
                        onValueChange={(value) => {
                          const nextEndTime = ruleTimeOptions.find((option) => option > value) || settings.bookingEndTime;
                          setSettings((current) => ({
                            ...current,
                            bookingStartTime: value,
                            bookingEndTime: current.bookingEndTime > value ? current.bookingEndTime : nextEndTime,
                          }));
                        }}
                        disabled={loading}
                      >
                        <SelectTrigger className="mt-2 h-12 border-0 bg-background/80 text-base shadow-none">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {bookingStartOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
                      <Label className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Horario de Termino
                      </Label>
                      <Select
                        value={settings.bookingEndTime}
                        onValueChange={(value) => setSettings({ ...settings, bookingEndTime: value })}
                        disabled={loading}
                      >
                        <SelectTrigger className="mt-2 h-12 border-0 bg-background/80 text-base shadow-none">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {bookingEndOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Limite Max. Participantes</Label>
                  <Input
                    type="number"
                    disabled={loading}
                    value={settings.maxParticipants}
                    onChange={(event) =>
                      setSettings({ ...settings, maxParticipants: Number(event.target.value || 0) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Antecedencia Minima (min)</Label>
                  <Input
                    type="number"
                    disabled={loading}
                    value={settings.minAdvanceMinutes}
                    onChange={(event) =>
                      setSettings({ ...settings, minAdvanceMinutes: Number(event.target.value || 0) })
                    }
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="security" className="border-border px-5">
              <AccordionTrigger className="text-foreground hover:no-underline">
                Seguranca
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-5">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Senha Atual</Label>
                    <Input
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                      }
                      placeholder="Digite a senha atual"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nova Senha</Label>
                    <Input
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                      }
                      placeholder="Minimo de 8 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Confirmar Nova Senha</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(event) =>
                        setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                      }
                      placeholder="Repita a nova senha"
                    />
                  </div>
                </div>

                <Button
                  onClick={() => void handlePasswordChange()}
                  disabled={changingPassword}
                  className="syntra-gradient text-white"
                >
                  {changingPassword ? "Atualizando..." : "Atualizar Senha"}
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="email" className="border-border px-5">
              <AccordionTrigger className="text-foreground hover:no-underline">
                Servidor de Saida de E-mail
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pb-5">
                <div className="flex items-start justify-between gap-4 rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="space-y-1">
                    <Label htmlFor="email-enabled">Ativar configuracao SMTP</Label>
                    <p className="text-sm text-muted-foreground">
                      Esta configuracao prepara o servidor de saida para envio futuro de e-mails.
                    </p>
                  </div>
                  <Switch
                    id="email-enabled"
                    checked={settings.emailEnabled}
                    disabled={loading}
                    onCheckedChange={(checked) => setSettings({ ...settings, emailEnabled: checked })}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Servidor SMTP</Label>
                    <Input
                      disabled={smtpDisabled}
                      value={settings.smtpHost}
                      onChange={(event) => setSettings({ ...settings, smtpHost: event.target.value })}
                      placeholder="smtp.seudominio.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Porta</Label>
                    <Input
                      type="number"
                      disabled={smtpDisabled}
                      value={settings.smtpPort}
                      onChange={(event) => setSettings({ ...settings, smtpPort: Number(event.target.value || 0) })}
                      placeholder="587"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Seguranca</Label>
                    <Select
                      value={settings.smtpSecurity}
                      onValueChange={(value: SettingsData["smtpSecurity"]) =>
                        setSettings({ ...settings, smtpSecurity: value })
                      }
                      disabled={smtpDisabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem criptografia</SelectItem>
                        <SelectItem value="starttls">STARTTLS</SelectItem>
                        <SelectItem value="ssl_tls">SSL/TLS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Usuario SMTP</Label>
                    <Input
                      disabled={smtpDisabled}
                      value={settings.smtpUsername}
                      onChange={(event) => setSettings({ ...settings, smtpUsername: event.target.value })}
                      placeholder="usuario@seudominio.com"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Senha SMTP</Label>
                    <Input
                      type="password"
                      disabled={smtpDisabled}
                      value={settings.smtpPassword}
                      onChange={(event) => setSettings({ ...settings, smtpPassword: event.target.value })}
                      placeholder={
                        settings.smtpPasswordConfigured
                          ? "Ja configurada. Preencha apenas para substituir."
                          : "Digite a senha do servidor SMTP"
                      }
                    />
                    {settings.smtpPasswordConfigured && settings.smtpPassword === "" && (
                      <p className="text-xs text-muted-foreground">
                        A senha atual sera mantida se este campo ficar em branco.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Nome do Remetente</Label>
                    <Input
                      disabled={smtpDisabled}
                      value={settings.smtpFromName}
                      onChange={(event) => setSettings({ ...settings, smtpFromName: event.target.value })}
                      placeholder="Equipe Syntra"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail do Remetente</Label>
                    <Input
                      type="email"
                      disabled={smtpDisabled}
                      value={settings.smtpFromEmail}
                      onChange={(event) => setSettings({ ...settings, smtpFromEmail: event.target.value })}
                      placeholder="nao-responda@seudominio.com"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>E-mail de Resposta</Label>
                    <Input
                      type="email"
                      disabled={smtpDisabled}
                      value={settings.smtpReplyToEmail}
                      onChange={(event) => setSettings({ ...settings, smtpReplyToEmail: event.target.value })}
                      placeholder="suporte@seudominio.com"
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <Button onClick={() => void handleSave()} disabled={saving || loading} className="syntra-gradient text-white">
          {saving ? "Salvando..." : "Salvar Configuracoes"}
        </Button>
      </motion.div>
    </Layout>
  );
}
