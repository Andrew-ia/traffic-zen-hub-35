import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { CommandMenuProvider } from "./CommandMenu";
import { useResponsive } from "@/hooks/use-responsive";
import { useState, useEffect } from "react";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { isMobile, isTablet } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  return (
    <CommandMenuProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar 
          isOpen={sidebarOpen} 
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          onClose={() => setSidebarOpen(false)}
        />
        
        {/* Overlay for mobile */}
        {sidebarOpen && (isMobile || isTablet) && (
          <div 
            className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out lg:pl-64">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 p-2 overflow-x-hidden">
            <div className="mx-auto max-w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </CommandMenuProvider>
  );
}
