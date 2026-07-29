import clsx from "clsx";

interface LogoProps {
  /** Icon size in px */
  size?: number;
  /** Show "CatDex" wordmark + tagline below */
  wordmark?: boolean;
  className?: string;
}

/** CatDex brand: circular cat-ball icon, "CatDex" wordmark, tagline. */
export function Logo({ size = 96, wordmark, className }: LogoProps) {
  return (
    <div className={clsx("flex flex-col items-center", className)}>
      {/*
        icon-192.png is a maskable PWA icon: it ships with a ~3% transparent
        safe-zone margin on every edge (Android's adaptive-icon spec). That
        margin is invisible on a square favicon, but a plain circular crop
        exposes it as gaps at the top/bottom/left/right of the circle. Scale
        the image up inside an overflow-hidden circle so its opaque content
        clears the mask on every side.
      */}
      <div className="overflow-hidden rounded-full shrink-0" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="CatDex" className="w-full h-full object-cover scale-[1.15]" />
      </div>
      {wordmark && (
        <>
          <p className="mt-4 text-[2rem] font-bold tracking-tight leading-none">
            <span className="text-catdex-text">Cat</span>
            <span className="text-catdex-orange">Dex</span>
          </p>
          <p className="mt-2 text-sm text-catdex-text-muted">Tu Pokédex de gatos reales</p>
        </>
      )}
    </div>
  );
}
