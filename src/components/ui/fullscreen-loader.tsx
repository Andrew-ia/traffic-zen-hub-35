import React from "react";

interface FullscreenLoaderProps {
  title?: string;
  subtitle?: string;
  progress?: number | null;
}

export function FullscreenLoader({ title = "Carregando", subtitle, progress }: FullscreenLoaderProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      {/* Ambient gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rounded-full bg-gradient-to-br from-pink-500/25 via-purple-500/25 to-blue-500/25 blur-3xl animate-pulse" />
      </div>

      <div className="relative flex flex-col items-center gap-3 px-8 py-10 rounded-2xl border border-border/60 bg-card/70 shadow-xl">
        {/* Spinner */}
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          {/* Inner dot */}
          <div className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-primary" />
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold">{title}</p>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>

        {typeof progress === "number" && (
          <div className="mt-1 text-xs text-muted-foreground">Progresso: {progress}%</div>
        )}
      </div>
    </div>
  );
}

export default FullscreenLoader;

