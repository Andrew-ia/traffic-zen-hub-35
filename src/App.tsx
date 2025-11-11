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
import GA4 from "./pages/GA4";
import Tracking from "./pages/Tracking";
import MetaAds from "./pages/MetaAds";
import Instagram from "./pages/Instagram";
import AIChat from "./pages/AIChat";
import NotFound from "./pages/NotFound";
import Cashflow from "./pages/Cashflow";
import ProjectManagement from "./pages/ProjectManagementV2";
import { useEffect } from "react";
import { gtmPush } from "@/lib/gtm";

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
        <MainLayout>
          <PageViewTracker />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/chat" element={<AIChat />} />
            <Route path="/projects" element={<ProjectManagement />} />
            <Route path="/campaigns/:campaignId" element={<CampaignDetails />} />
            <Route path="/ads/:adId" element={<AdDetails />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/meta-ads" element={<MetaAds />} />
            <Route path="/instagram" element={<Instagram />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/gerador-looks" element={<VirtualTryOn />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/integrations" element={<Integrations />} />
            <Route path="/ga4" element={<GA4 />} />
            <Route path="/gtm" element={<GA4 />} />
            <Route path="/tracking" element={<Tracking />} />
            <Route path="/cashflow" element={<Cashflow />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
