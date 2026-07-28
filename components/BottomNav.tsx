"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import type React from "react";
import { Cat, MapPin, BarChart3, Settings } from "lucide-react";

type NavItemDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; color?: string; fill?: string }>;
  outlineOnly?: boolean;
};

const NAV_ITEMS: NavItemDef[] = [
  { href: "/", label: "Colección", icon: Cat },
  { href: "/map", label: "Mapa", icon: MapPin },
  { href: "/stats", label: "Stats", icon: BarChart3, outlineOnly: true },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

// El de captura se renderiza aparte como FAB elevado, no como item más de la lista
const CAPTURE_ITEM = { href: "/capture", label: "Atrapar" };

export function BottomNav() {
  const pathname = usePathname();

  return (
      <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden">
      <div className="relative w-full">
        <nav className="flex items-center justify-between bg-[#FAF6EE] rounded-none px-8 pt-5 pb-5 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {NAV_ITEMS.slice(0, 2).map((item) => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}

          <div className="w-16 shrink-0" aria-hidden="true" />

          {NAV_ITEMS.slice(2).map((item) => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        <Link href={CAPTURE_ITEM.href} aria-label={CAPTURE_ITEM.label} className="absolute left-1/2 -translate-x-1/2 -top-4 w-28 h-28 rounded-full bg-[#FAF6EE] p-2">
          <div className="w-full h-full rounded-full  overflow-hidden">
            <Image src="/button.png" alt={CAPTURE_ITEM.label} width={96} height={96} className="w-full h-full object-cover scale-125" unoptimized />
          </div>
        </Link>
      </div>
    </div>
  );
}

function NavItem({
  item,
  active,
}: {
  item: NavItemDef;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="flex flex-col items-center w-14">
      <span className="flex items-center justify-center w-14 h-14 rounded-xl">
        <Icon
          className="h-8 w-8"
          color={active ? (item.outlineOnly ? "#F5793A" : "#FAF6EE") : "#2A2A2A"}
          fill={active && !item.outlineOnly ? "#F5793A" : "none"}
        />
      </span>
    </Link>
  );
}