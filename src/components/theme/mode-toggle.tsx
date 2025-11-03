import { useTheme } from "next-themes";
import { MoonStar, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function ModeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = theme === "system" ? resolvedTheme : theme;
  const isDark = current === "dark";
  const nextTheme = isDark ? "light" : "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("h-9 w-9", className)}
      onClick={() => setTheme(nextTheme ?? "light")}
      aria-label={isDark ? "Ativar modo claro" : "Ativar modo escuro"}
      disabled={!mounted}
    >
      <Sun className={cn("h-5 w-5 transition-all", isDark && "rotate-90 scale-0")} />
      <MoonStar className={cn("absolute h-5 w-5 transition-all", isDark ? "rotate-0 scale-100" : "-rotate-90 scale-0")} />
      <span className="sr-only">Alternar tema</span>
    </Button>
  );
}

