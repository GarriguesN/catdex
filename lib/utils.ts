import { clsx, type ClassValue } from "clsx";

// Simple cn() — clsx-only, no tailwind-merge needed for CatDex
export function cn(...args: ClassValue[]): string {
  return clsx(...args);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7) return `hace ${days}d`;
  return formatDate(timestamp);
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function roundCoord(coord: number): number {
  return Math.round(coord * 10000) / 10000;
}
