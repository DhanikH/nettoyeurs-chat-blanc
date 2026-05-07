import React, { createContext, useContext, useState, useEffect } from "react";

type User = {
  id: string;
  role: "guest" | "homeowner" | "cleaner" | "admin" | "demo_admin";
  email: string;
  full_name?: string;
  profile_picture?: string;
  loyalty_subscription_tier: "none" | "monthly" | "biweekly" | "weekly";
  is_approved?: boolean;
};

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Error parsing stored user:", e);
        localStorage.removeItem("user");
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if the user is still valid or refresh token if needed
    // For now, we just mark loading as false since we initialized from localStorage
    setLoading(false);
  }, []);

  const login = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem("user", JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
