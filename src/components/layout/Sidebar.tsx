import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { mainNavigation, NavigationEntry } from "@/data/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useResponsive } from "@/hooks/use-responsive";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export function Sidebar({ isOpen, onToggle, onClose, isCollapsed, onCollapsedChange }: SidebarProps) {
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { user, hasAccess } = useAuth();
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("trafficpro.nav.groups");
      const parsed = raw ? JSON.parse(raw) : {};
      return typeof parsed === "object" && parsed ? parsed : {};
    } catch {
      return {};
    }
  });
  const saveGroupOpen = (next: Record<string, boolean>) => {
    setGroupOpen(next);
    try {
      localStorage.setItem("trafficpro.nav.groups", JSON.stringify(next));
    } catch {
      void 0;
    }
  };

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (isMobile) {
      onClose();
    }
  }, [location.pathname, isMobile, onClose]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-[100] bg-card/95 backdrop-blur-md border-r border-border/50 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
        isMobile ? "w-64" : (isCollapsed ? "w-16" : "w-64"),
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
      style={{
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y'
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          {!isCollapsed && (
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Traffic Pro
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCollapsedChange(!isCollapsed)}
            className="hidden lg:flex h-8 w-8 ml-auto"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4 overflow-y-auto">
          {mainNavigation.map((entry: NavigationEntry) => {
            if (!user) return null;
            if ("children" in entry) {
              const activeChild = entry.children.some((c) => location.pathname.startsWith(c.href));
              const parentAllowed = hasAccess(entry.href);
              const childrenAllowed = entry.children.filter((child) => hasAccess(child.href));
              if (!parentAllowed && childrenAllowed.length === 0) return null;
              const isOpenGroup = groupOpen[entry.href] ?? true;
              return (
                <div key={entry.name} className="space-y-1">
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
                      activeChild ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    )}
                  >
                    <NavLink
                      to={entry.href}
                      end={entry.href === "/" || entry.href === "/campaigns"}
                      className="flex items-center gap-3 flex-1"
                      onClick={() => isMobile && onClose()}
                    >
                      <entry.icon className="h-5 w-5 flex-shrink-0" />
                      {!isCollapsed && <span className="truncate">{entry.name}</span>}
                    </NavLink>
                    {!isCollapsed && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          const next = { ...groupOpen, [entry.href]: !isOpenGroup };
                          saveGroupOpen(next);
                        }}
                      >
                        {isOpenGroup ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  {childrenAllowed.length > 0 && isOpenGroup && (
                    <div className="ml-6 space-y-1">
                      {childrenAllowed.map((child) => (
                        <NavLink
                          key={child.href}
                          to={child.href}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-all hover:bg-secondary/60",
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground"
                            )
                          }
                          onClick={() => isMobile && onClose()}
                        >
                          <child.icon className="h-4 w-4 flex-shrink-0" />
                          {!isCollapsed && <span className="truncate">{child.name}</span>}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }
            if (entry.href === "/campaigns") return null;
            if (!hasAccess(entry.href)) return null;
            return (
              <NavLink
                key={entry.name}
                to={entry.href}
                end={entry.href === "/" || entry.href === "/campaigns"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                  )
                }
                onClick={() => isMobile && onClose()}
              >
                <entry.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">{entry.name}</span>}
              </NavLink>
            );
          })}
        </nav>


      </div>
    </aside>
  );
}
