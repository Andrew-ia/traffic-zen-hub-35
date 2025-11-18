import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignDetails from "./pages/CampaignDetails";
import AdDetails from "./pages/AdDetails";
import Reports from "./pages/Reports";
import Leads from "./pages/Leads";
import VirtualTryOn from "./pages/VirtualTryOnV2";
import Automations from "./pages/Automations";
import Experiments from "./pages/Experiments";
import Integrations from "./pages/Integrations";
import InternalChat from "./pages/InternalChat";
import Tracking from "./pages/Tracking";
import MetaAds from "./pages/MetaAds";
import Instagram from "./pages/Instagram";
import GoogleAnalytics from "./pages/GoogleAnalytics";
import NotFound from "./pages/NotFound";
import ProjectManagement from "./pages/ProjectManagementV3";
import { useEffect } from "react";
import { gtmPush } from "@/lib/gtm";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import { AuthProvider } from "./hooks/useAuth";
import { RequireAuth } from "@/components/layout/RequireAuth";

const queryClient = new QueryClient();

function PageViewTracker() {
  const location = useLocation();
  useEffect(() => {
    // Respeita a configuração local para habilitar/desabilitar page_view
    let enabled = true;
    try {
      const raw = window.localStorage.getItem("trafficpro.gtm.config");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.enablePageView === "boolean") {
          enabled = parsed.enablePageView;
        }
      }
    } catch (e) {
      // Falha ao ler storage não deve bloquear page_view
    }

    if (enabled) {
      gtmPush("page_view", {
        page_path: location.pathname + location.search,
        page_title: document.title,
      });
    }
  }, [location.pathname, location.search]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <MainLayout>
            <PageViewTracker />
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
              
              <Route path="/projects" element={<RequireAuth><ProjectManagement /></RequireAuth>} />
              <Route path="/campaigns/:campaignId" element={<RequireAuth><CampaignDetails /></RequireAuth>} />
              <Route path="/ads/:adId" element={<RequireAuth><AdDetails /></RequireAuth>} />
              <Route path="/campaigns" element={<RequireAuth><Campaigns /></RequireAuth>} />
              <Route path="/meta-ads" element={<RequireAuth><MetaAds /></RequireAuth>} />
              
              <Route path="/instagram" element={<RequireAuth><Instagram /></RequireAuth>} />
              <Route path="/google-analytics" element={<RequireAuth><GoogleAnalytics /></RequireAuth>} />
              <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
              <Route path="/leads" element={<RequireAuth><Leads /></RequireAuth>} />
              <Route path="/gerador-looks" element={<RequireAuth><VirtualTryOn /></RequireAuth>} />
              <Route path="/automations" element={<RequireAuth><Automations /></RequireAuth>} />
              <Route path="/experiments" element={<RequireAuth><Experiments /></RequireAuth>} />
              <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
              <Route path="/internal-chat" element={<RequireAuth><InternalChat /></RequireAuth>} />
              
              <Route path="/tracking" element={<RequireAuth><Tracking /></RequireAuth>} />
              
              <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MainLayout>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
