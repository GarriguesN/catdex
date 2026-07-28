"use client";

import Link from "next/link";
import { Camera } from "lucide-react";

export function FAB() {
  return (
    <Link
      href="/capture"
      className="fixed bottom-14 right-4 z-40 sm:bottom-6 sm:right-6 w-14 h-14 bg-pokedex-red rounded-full flex items-center justify-center shadow-lg shadow-pokedex-red/30 active:scale-95 transition-transform hover:bg-pokedex-red-dark"
      aria-label="Atrapar gato"
    >
      <Camera className="h-7 w-7 text-white" />
    </Link>
  );
}
