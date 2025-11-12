import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { mainNavigation } from "@/data/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useResponsive } from "@/hooks/use-responsive";

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function Sidebar({ isOpen, onToggle, onClose }: SidebarProps) {
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { user, hasAccess } = useAuth();

  // Close sidebar on route change for mobile
  useEffect(() => {
    if (isMobile) {
      onClose();
    }
  }, [location.pathname, isMobile, onClose]);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card/95 backdrop-blur-md border-r border-border/50 transform transition-all duration-300 ease-in-out lg:translate-x-0 shadow-xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-6 border-b border-border">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TrafficPro
            </h1>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
            {(mainNavigation.filter((item) => {
              if (!user) return false;
              return hasAccess(item.href);
            })).map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === "/" || item.href === "/campaigns"}
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
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </NavLink>
            ))}
          </nav>

          
        </div>
      </aside>
  );
}
