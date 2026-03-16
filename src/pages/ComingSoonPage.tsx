import { useState } from "react";
import syntraLogo from "@/assets/syntra-logo.png";
import { toast } from "sonner";

const ComingSoonPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    // Simulate API call
    await new Promise((r) => setTimeout(r, 800));
    toast.success("Email registrado! Você será avisado no lançamento.");
    setEmail("");
    setLoading(false);
  };

  return (
    <div className="coming-soon-page min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(135deg, #14003C 0%, #502878 50%, #8B5CF6 100%)",
        }}
      />

      {/* Glow effect */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-[5] w-[600px] h-[600px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(139,92,246,0.35) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Content */}
      <div className="flex flex-col items-center text-center max-w-lg w-full gap-8">
        {/* Logo */}
        <img
          src={syntraLogo}
          alt="Syntra Spaces"
          className="h-12 object-contain"
        />

        {/* Title */}
        <div className="space-y-4">
          <h1
            className="font-bold tracking-tight"
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "42px",
              color: "#FFFFFF",
            }}
          >
            Syntra Spaces
          </h1>
          <p
            className="leading-relaxed"
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "18px",
              color: "rgba(255,255,255,0.8)",
            }}
          >
            A nova forma inteligente de gerenciar e reservar espaços corporativos.
          </p>
        </div>

        {/* Glassmorphism card */}
        <div
          className="w-full rounded-2xl p-8 space-y-5"
          style={{
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          }}
        >
          <p
            className="leading-relaxed"
            style={{
              fontFamily: "'Jost', sans-serif",
              fontSize: "15px",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Estamos finalizando os últimos detalhes da plataforma.
            <br />
            Deixe seu email para ser avisado quando o Syntra Spaces for lançado.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Digite seu email"
              className="flex-1 h-12 px-4 rounded-xl text-sm outline-none transition-all duration-200 placeholder:text-white/40"
              style={{
                fontFamily: "'Jost', sans-serif",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#FFFFFF",
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 px-6 rounded-xl text-sm font-medium text-white whitespace-nowrap transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-60 disabled:pointer-events-none"
              style={{
                fontFamily: "'Jost', sans-serif",
                background: "linear-gradient(135deg, #502878 0%, #8B5CF6 100%)",
                boxShadow: "0 4px 20px rgba(139,92,246,0.3)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = "0 8px 30px rgba(139,92,246,0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(139,92,246,0.3)";
              }}
            >
              {loading ? "Enviando..." : "Quero ser avisado"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p
          style={{
            fontFamily: "'Jost', sans-serif",
            fontSize: "13px",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          © {new Date().getFullYear()} Syntra. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default ComingSoonPage;
