import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { User, UserRole } from "@/lib/mockData";

interface AuthContextType {
  user: User | null;
  role: UserRole;
  login: (email: string, password: string) => Promise<User>;
  changePassword: (payload: { currentPassword?: string; newPassword: string; confirmPassword: string }) => Promise<User>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const response = await api.auth.me();
      setUser(response.user);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let active = true;

    const loadCurrentUser = async () => {
      try {
        const response = await api.auth.me();
        if (active) {
          setUser(response.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      active = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.auth.login(email, password);
    setUser(response.user);
    return response.user;
  };

  const changePassword = async (payload: { currentPassword?: string; newPassword: string; confirmPassword: string }) => {
    const response = await api.auth.changePassword(payload);
    setUser(response.user);
    return response.user;
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || "client",
        login,
        changePassword,
        logout,
        isAuthenticated: !!user,
        isLoading,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
