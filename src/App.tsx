import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import TrafficAnalysis from "./pages/TrafficAnalysis";
import ActionCenter from "./pages/ActionCenter";
import Campaigns from "./pages/Campaigns";
import CampaignDetails from "./pages/CampaignDetails";
import AdDetails from "./pages/AdDetails";
import Reports from "./pages/Reports";
import Budget from "./pages/Budget";
import Calendar from "./pages/Calendar";
import Leads from "./pages/Leads";
import Creatives from "./pages/Creatives";
import CreativesV2 from "./pages/CreativesV2";
import CreativesGrouped from "./pages/CreativesGrouped";
import CreativesV3 from "./pages/CreativesV3";
import VirtualTryOn from "./pages/VirtualTryOn";
import Audiences from "./pages/Audiences";
import UTMs from "./pages/UTMs";
import Automations from "./pages/Automations";
import Experiments from "./pages/Experiments";
import Integrations from "./pages/Integrations";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/action-center" element={<ActionCenter />} />
            <Route path="/traffic-analysis" element={<TrafficAnalysis />} />
            <Route path="/campaigns/:campaignId" element={<CampaignDetails />} />
            <Route path="/ads/:adId" element={<AdDetails />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/creatives" element={<CreativesV3 />} />
            <Route path="/creatives-old" element={<Creatives />} />
            <Route path="/creatives-v2" element={<CreativesV2 />} />
            <Route path="/creatives-grouped" element={<CreativesGrouped />} />
            <Route path="/gerador-looks" element={<VirtualTryOn />} />
            <Route path="/audiences" element={<Audiences />} />
            <Route path="/utms" element={<UTMs />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/experiments" element={<Experiments />} />
            <Route path="/integrations" element={<Integrations />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
