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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt="CatDex"
        width={size}
        height={size}
        className="rounded-full"
        style={{ width: size, height: size }}
      />
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
