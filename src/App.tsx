import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import CalendarPage from "./pages/CalendarPage";
import RoomsPage from "./pages/RoomsPage";
import WhatsAppPage from "./pages/WhatsAppPage";
import SettingsPage from "./pages/SettingsPage";
import TicketsPage from "./pages/TicketsPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import MasterDashboard from "./pages/master/MasterDashboard";
import MasterClients from "./pages/master/MasterClients";
import ClientProfile from "./pages/master/ClientProfile";
import MasterTickets from "./pages/master/MasterTickets";
import NotFound from "./pages/NotFound";
import ComingSoonPage from "./pages/ComingSoonPage";

const queryClient = new QueryClient();

function AuthThemeSync() {
  const { user, isLoading } = useAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    setTheme(user?.themePreference || "dark");
  }, [isLoading, setTheme, user?.themePreference]);

  return null;
}

function AppRoutes() {
  const { isAuthenticated, isLoading, role, user } = useAuth();
  const isMaster = role === "master";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center syntra-gradient-dark p-4">
        <div className="glassmorphism p-8 text-center">
          <p className="text-sm text-muted-foreground">Carregando sessão...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (user?.mustChangePassword) {
    return (
      <Routes>
        <Route path="/primeiro-acesso" element={<ForcePasswordChangePage />} />
        <Route path="*" element={<Navigate to="/primeiro-acesso" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/agenda" element={<CalendarPage />} />
      <Route path="/salas" element={<RoomsPage />} />
      <Route path="/whatsapp" element={<WhatsAppPage />} />
      <Route path="/configuracoes" element={<SettingsPage />} />
      <Route path="/chamados" element={<TicketsPage />} />
      <Route path="/master" element={isMaster ? <MasterDashboard /> : <Navigate to="/" replace />} />
      <Route path="/master/clientes" element={isMaster ? <MasterClients /> : <Navigate to="/" replace />} />
      <Route path="/master/clientes/:clientId" element={isMaster ? <ClientProfile /> : <Navigate to="/" replace />} />
      <Route path="/master/chamados" element={isMaster ? <MasterTickets /> : <Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/coming" element={<ComingSoonPage />} />
            <Route path="*" element={
              <AuthProvider>
                <AuthThemeSync />
                <AppRoutes />
              </AuthProvider>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
