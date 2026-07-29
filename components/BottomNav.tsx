"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import type React from "react";
import clsx from "clsx";
import { Cat, MapPin, User, Settings } from "lucide-react";

type NavItemDef = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
};

const LEFT_ITEMS: NavItemDef[] = [
  { href: "/", label: "Colección", icon: Cat },
  { href: "/map", label: "Mapa", icon: MapPin },
];

const RIGHT_ITEMS: NavItemDef[] = [
  { href: "/profile", label: "Perfil", icon: User },
  { href: "/settings", label: "Ajustes", icon: Settings },
];

/** Routes with their own full-screen chrome — no bottom nav. */
const HIDDEN_ON = ["/capture", "/login"];

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      <div className="relative mx-auto w-full sm:max-w-lg">
        <nav
          className="flex items-end justify-between bg-catdex-cream/95 backdrop-blur-md px-7 pt-3 shadow-[0_-4px_24px_rgba(34,35,38,0.07)]"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {LEFT_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}

          {/* Space reserved for the floating capture button */}
          <div className="w-16 shrink-0" aria-hidden="true" />

          {RIGHT_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>

        {/* Center capture FAB — elevated, circular, largest element */}
        <Link
          href="/capture"
          aria-label="Capturar"
          className="absolute left-1/2 -translate-x-1/2 -top-7 w-[4.5rem] h-[4.5rem] rounded-full bg-catdex-surface p-1 shadow-fab transition-transform active:scale-95"
        >
          <span className="block w-full h-full rounded-full overflow-hidden ring-2 ring-catdex-orange/20">
            {/* icon-192.png has a ~3% maskable safe-zone margin — scale up so it clears the circular crop, see components/ui/Logo.tsx */}
            <Image
              src="/icon-192.png"
              alt=""
              width={64}
              height={64}
              className="w-full h-full object-cover scale-[1.15]"
              unoptimized
            />
          </span>
        </Link>
      </div>
    </div>
  );
}

function NavItem({ item, active }: { item: NavItemDef; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} className="flex flex-col items-center gap-1 w-14 pb-0.5">
      <Icon
        className={clsx("h-6 w-6 transition-colors", active ? "text-catdex-orange" : "text-catdex-text-muted")}
        strokeWidth={active ? 2.2 : 1.8}
      />
      <span
        className={clsx(
          "text-[0.625rem] font-semibold leading-none transition-colors",
          active ? "text-catdex-orange" : "text-catdex-text-muted"
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}
