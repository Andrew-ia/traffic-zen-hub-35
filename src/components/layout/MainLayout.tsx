import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandMenuProvider } from "./CommandMenu";
import { useResponsive } from "@/hooks/use-responsive";
import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isMobile, isTablet } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  const location = useLocation();
  const isLogin = location.pathname === "/login";

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <CommandMenuProvider>
      <div className="flex min-h-screen w-full bg-background">
        {!isLogin && (
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            onClose={() => setSidebarOpen(false)}
            isCollapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        )}

        {/* Overlay for mobile */}
        {!isLogin && sidebarOpen && (isMobile || isTablet) && (
          <div
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out",
          !isLogin && (sidebarCollapsed ? "lg:pl-16" : "lg:pl-64")
        )}>
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 p-2 sm:p-4 lg:p-6 overflow-x-hidden">
            <div className="mx-auto max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CommandMenuProvider>
  );
}
