import { Menu, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { mainNavigation } from "@/data/navigation";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center px-6 border-b border-border">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              TrafficPro
            </h1>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {mainNavigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="rounded-lg bg-gradient-to-br from-primary/10 to-accent/10 p-4">
              <p className="text-sm font-medium mb-1">Upgrade para Pro</p>
              <p className="text-xs text-muted-foreground mb-3">
                Desbloqueie recursos avançados
              </p>
              <Button size="sm" className="w-full">
                Upgrade
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
