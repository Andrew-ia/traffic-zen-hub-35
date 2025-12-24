import { useEffect, useMemo, useRef } from "react";
import { Bell, Command, HelpCircle, Search, User, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { useCommandMenu } from "./CommandMenu";
import { useResponsive } from "@/hooks/use-responsive";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { AvatarSelector } from "@/components/user/AvatarSelector";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
import { adsFeaturesEnabled } from "@/lib/featureFlags";

function isEditableElement(element: EventTarget | null) {
  if (!element || !(element instanceof HTMLElement)) return false;
  const tagName = element.tagName;
  return element.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
}

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { open, openHelp } = useCommandMenu();
  const { isMobile, isTablet } = useResponsive();
  const { logout, user } = useAuth();
  const displayName = useMemo(() => {
    return user?.name || user?.email || "Usuário";
  }, [user?.name, user?.email]);
  const initials = useMemo(() => {
    const src = user?.name || user?.email || "";
    const parts = src.replace(/[^a-zA-Z0-9@._-\s]/g, "").split(/[\s@._-]+/).filter(Boolean);
    const a = (parts[0] || "").charAt(0);
    const b = (parts[1] || "").charAt(0);
    return (a + b).toUpperCase() || "U";
  }, [user?.name, user?.email]);
  const isMac = useMemo(() => {
    if (typeof window === "undefined") return false;
    return /(Mac|iPhone|iPod|iPad)/i.test(navigator.platform);
  }, []);
  const searchPlaceholder = useMemo(() => {
    if (isMobile) return "Buscar...";
    return adsFeaturesEnabled
      ? "Buscar campanhas, relatórios..."
      : "Buscar páginas, produtos, análises...";
  }, [isMobile]);

  useEffect(() => {
    const handleFocusShortcut = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !isEditableElement(event.target)) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleFocusShortcut);
    return () => window.removeEventListener("keydown", handleFocusShortcut);
  }, []);

  return (
    <header className="sticky top-0 z-30 h-10 border-b border-border/50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-1 px-2 sm:px-3">
        {/* Menu Button for Mobile/Tablet */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden relative z-50"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMenuClick();
          }}
          aria-label="Abrir menu"
          type="button"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Abrir menu</span>
        </Button>

        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          {/* Search Input - Responsive */}
          <div className="relative w-full max-w-xs sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={searchPlaceholder}
              className="pl-10 pr-8 sm:pr-16 text-sm w-full transition-all duration-300 focus:w-full h-8"
            />
            {!isMobile && (
              <span className="pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                /
              </span>
            )}
          </div>

          {/* Quick Search Button - Hidden on mobile */}
          {!isMobile && (
            <Button
              type="button"
              variant="outline"
              className="hidden items-center gap-2 px-3 py-2 text-sm text-muted-foreground md:flex"
              onClick={() => open("default")}
            >
              <Command className="h-4 w-4" />
              <span className="hidden lg:inline">Busca rápida</span>
              <span className="ml-auto flex items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isMac ? "⌘" : "Ctrl"}K
              </span>
            </Button>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
          <WorkspaceSwitcher />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <ModeToggle />

          {!isMobile && (
            <Button type="button" variant="ghost" size="icon" onClick={() => openHelp()}>
              <HelpCircle className="h-5 w-5" />
              <span className="sr-only">Abrir ajuda</span>
            </Button>
          )}

          <NotificationBell />

          <AvatarSelector />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold">
                    {initials}
                  </div>
                  <span className="hidden md:inline text-xs font-medium truncate max-w-[120px]">{displayName}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-popover">
              <DropdownMenuLabel>
                <div className="space-y-0.5">
                  <div className="text-sm font-semibold">Minha Conta</div>
                  <div className="text-xs text-muted-foreground truncate">{displayName}</div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              {isMobile && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openHelp()}>
                    <HelpCircle className="h-4 w-4 mr-2" />
                    Ajuda
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => logout()}>Sair</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
