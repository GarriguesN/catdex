"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPocketBase } from "@/lib/pocketbase";
import type PocketBase from "pocketbase";

interface AuthState {
  pb: PocketBase;
  user: Record<string, any> | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ pb: null as any, user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    pb: getPocketBase(),
    user: null,
    loading: true,
  });

  useEffect(() => {
    const pb = getPocketBase();
    
    function refresh() {
      setState({
        pb,
        user: pb.authStore.record || null,
        loading: false,
      });
    }

    refresh();

    const handler = () => refresh();
    window.addEventListener("pb-auth-change", handler);
    return () => window.removeEventListener("pb-auth-change", handler);
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
