"use client";

import { useEffect, useRef } from "react";

// Browsers commonly fire `focus` and `visibilitychange` back-to-back on the
// same tab-refocus — skip a second call within this window.
const DEDUPE_MS = 300;

/**
 * Re-runs `callback` when the tab regains focus or becomes visible again —
 * catches data that changed elsewhere (e.g. a friend accepted a request)
 * while this page sat open but backgrounded, without requiring a full
 * remount/navigation to see it.
 */
export function useRefetchOnFocus(callback: () => void) {
  const lastRunRef = useRef(0);

  useEffect(() => {
    function run() {
      const now = Date.now();
      if (now - lastRunRef.current < DEDUPE_MS) return;
      lastRunRef.current = now;
      callback();
    }
    function handleVisibility() {
      if (document.visibilityState === "visible") run();
    }
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [callback]);
}
