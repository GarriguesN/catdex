"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Cat, Camera, Map, BarChart3, Settings } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Colección", icon: Cat },
  { href: "/map", label: "Mapa", icon: Map },
  { href: "/capture", label: "Atrapar", icon: Camera },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-pokedex-gray-dark/95 backdrop-blur-md border-t-2 border-pokedex-red sm:hidden">
      <div className="flex items-center justify-around h-12 pb-[env(safe-area-inset-bottom,0px)]">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center h-full px-2 transition-colors ${
                active
                  ? "text-pokedex-red"
                  : "text-muted-foreground hover:text-pokedex-gray-light"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] leading-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
