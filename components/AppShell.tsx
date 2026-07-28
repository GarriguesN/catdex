"use client";

import { useState } from "react";
import type React from "react";
import { useAuth } from "@/lib/auth-provider";
import { BottomNav } from "@/components/BottomNav";
import { PermissionsGate, isPermissionsGranted } from "@/components/PermissionsGate";

/**
 * Hides the bottom nav (and its reserved space) while logged out or loading,
 * and blocks access to every route behind the permissions gate until camera
 * + location are both granted.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  // Set once the user completes the gate in this session, so we don't need
  // to re-read localStorage after granting (permissionsGranted below already
  // covers everything before that point via a plain, effect-free render read).
  const [justGranted, setJustGranted] = useState(false);

  const permissionsGranted =
    justGranted || (typeof window !== "undefined" && !!user && isPermissionsGranted());
  const needsPermissions = !loading && !!user && !permissionsGranted;
  const showNav = !loading && !!user && permissionsGranted;

  return (
    <div className={`flex-1 flex flex-col ${showNav ? "bottom-nav-spacer" : ""}`}>
      <main className="flex-1 px-3 sm:px-4 pb-4">
        {needsPermissions ? (
          <PermissionsGate onComplete={() => setJustGranted(true)} />
        ) : (
          children
        )}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
