import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CalendarCheck, MessageCircle, MessageSquare, RefreshCcw, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type WhatsappData } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export default function WhatsAppPage() {
  const { user } = useAuth();
  const [connection, setConnection] = useState<WhatsappData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingQrCode, setRequestingQrCode] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const qrCodeBase64Ref = useRef<string | null>(null);
  const autoRequestedQrCodeRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    qrCodeBase64Ref.current = qrCodeBase64;
  }, [qrCodeBase64]);

  const refreshConnection = async (showError = false) => {
    try {
      const data = await api.client.whatsapp();

      if (!isMountedRef.current) {
        return null;
      }

      setConnection(data);

      if (data.connected) {
        if (qrCodeBase64Ref.current) {
          toast.success("WhatsApp conectado.");
        }

        setQrCodeBase64(null);
        autoRequestedQrCodeRef.current = false;
      }

      return data;
    } catch (error) {
      if (isMountedRef.current && showError) {
        toast.error(error instanceof Error ? error.message : "Nao foi possivel carregar o WhatsApp.");
      }

      return null;
    }
  };

  const requestQrCode = async ({ showSuccessToast = true }: { showSuccessToast?: boolean } = {}) => {
    setRequestingQrCode(true);

    try {
      const isRefreshingQrCode = Boolean(qrCodeBase64Ref.current);
      const data = await api.client.connectWhatsapp();

      if (!isMountedRef.current) {
        return null;
      }

      const nextQrCode = data.qrCodeBase64 || null;

      if (!nextQrCode) {
        throw new Error("Nao foi possivel gerar um novo QR Code.");
      }

      setConnection(data);
      setQrCodeBase64(nextQrCode);
      autoRequestedQrCodeRef.current = true;

      if (showSuccessToast) {
        toast.success(isRefreshingQrCode ? "QR Code atualizado." : "QR Code gerado.");
      }

      return data;
    } catch (error) {
      if (isMountedRef.current) {
        toast.error(error instanceof Error ? error.message : "Nao foi possivel gerar o QR Code.");
      }

      return null;
    } finally {
      if (isMountedRef.current) {
        setRequestingQrCode(false);
      }
    }
  };

  useEffect(() => {
    const loadInitialConnection = async () => {
      try {
        const data = await refreshConnection(true);

        if (data && !data.connected && !qrCodeBase64Ref.current && !autoRequestedQrCodeRef.current) {
          autoRequestedQrCodeRef.current = true;
          const qrData = await requestQrCode({ showSuccessToast: false });

          if (!qrData) {
            autoRequestedQrCodeRef.current = false;
          }
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    };

    void loadInitialConnection();

    const intervalId = window.setInterval(() => {
      void refreshConnection(false);
    }, 10000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const handleGenerateQrCode = async () => {
    await requestQrCode();
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);

    try {
      const data = await api.client.disconnectWhatsapp();
      setConnection(data);
      setQrCodeBase64(null);
      toast.success("WhatsApp desconectado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nao foi possivel desconectar o WhatsApp.");
    } finally {
      setDisconnecting(false);
    }
  };

  const connected = connection?.connected || false;
  const showQrCode = !connected && !!qrCodeBase64;

  return (
    <Layout title="Conexao WhatsApp">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto space-y-6">
        <div className="syntra-card p-8 text-center purple-glow">
          <div className="flex justify-center mb-6">
            <div className="h-16 w-16 rounded-2xl syntra-gradient flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-white" />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando status da conexao...</p>
          ) : connected ? (
            <>
              <Badge className="bg-green-100 text-green-700 border-0 gap-1 mb-4">
                <Wifi className="h-3 w-3" />
                Conectado
              </Badge>
              <p className="text-foreground font-medium text-lg">{connection?.phoneNumber || "Numero nao informado"}</p>
              <p className="text-muted-foreground text-sm mt-1">
                {connection?.displayName || user?.agentName || "Agente do cliente"}
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                Ultima sincronizacao: {connection?.lastSync || "sem registro"}
              </p>
              <Button
                variant="destructive"
                className="mt-6"
                onClick={() => void handleDisconnect()}
                disabled={disconnecting}
              >
                <WifiOff className="h-4 w-4 mr-2" />
                {disconnecting ? "Desconectando..." : "Desconectar WhatsApp"}
              </Button>
            </>
          ) : (
            <>
              <Badge variant="secondary" className="gap-1 mb-4">
                <WifiOff className="h-3 w-3" />
                Desconectado
              </Badge>
              <div className="mx-auto w-64 h-64 sm:w-80 sm:h-80 rounded-xl border-2 border-dashed border-border flex items-center justify-center my-6 overflow-hidden bg-background">
                {showQrCode ? (
                  <img src={qrCodeBase64 || ""} alt="QR Code do WhatsApp" className="h-full w-full object-contain" />
                ) : (
                  <p className="text-muted-foreground text-sm px-4">QR Code sera exibido aqui</p>
                )}
              </div>
              <p className="text-muted-foreground text-sm">
                {showQrCode
                  ? "Escaneie o QR Code com o WhatsApp. O status sera atualizado automaticamente."
                  : "Clique abaixo para gerar um QR Code e conectar a instancia do WhatsApp."}
              </p>
              <Button
                className="mt-4 syntra-gradient text-white"
                onClick={() => void handleGenerateQrCode()}
                disabled={requestingQrCode}
              >
                {qrCodeBase64 ? <RefreshCcw className="h-4 w-4 mr-2" /> : null}
                {requestingQrCode ? "Gerando..." : qrCodeBase64 ? "Atualizar QR Code" : "Conectar WhatsApp"}
              </Button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="syntra-card p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl syntra-gradient flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mensagens Hoje</p>
              <p className="text-2xl font-bold text-foreground">{connection?.messagesToday ?? 0}</p>
            </div>
          </div>

          <div className="syntra-card p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl syntra-gradient flex items-center justify-center">
              <CalendarCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Reservas Hoje</p>
              <p className="text-2xl font-bold text-foreground">{connection?.reservationsToday ?? 0}</p>
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
