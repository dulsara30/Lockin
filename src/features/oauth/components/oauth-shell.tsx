import Image from 'next/image';

/** Branded card used by the OAuth consent and error screens (same look as login). */
export function OAuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="absolute inset-0 bg-brand-glow pointer-events-none" />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/logo.svg"
            alt="Lockin"
            width={160}
            height={40}
            className="h-10 w-auto mb-4"
            priority
          />
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
