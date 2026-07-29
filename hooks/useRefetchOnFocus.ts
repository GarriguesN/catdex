"use client";

import { useEffect } from "react";

/**
 * Re-runs `callback` when the tab regains focus or becomes visible again —
 * catches data that changed elsewhere (e.g. a friend accepted a request)
 * while this page sat open but backgrounded, without requiring a full
 * remount/navigation to see it.
 */
export function useRefetchOnFocus(callback: () => void) {
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") callback();
    }
    window.addEventListener("focus", callback);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", callback);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [callback]);
}
