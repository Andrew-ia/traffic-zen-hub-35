import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import VirtualTryOn from "./pages/VirtualTryOnV2";
import NotFound from "./pages/NotFound";
import { useEffect } from "react";
import { gtmPush } from "@/lib/gtm";
import Login from "./pages/Login";
import MercadoLivre from "./pages/MercadoLivreNew";
import MercadoLivreAnalyzer from "./pages/MercadoLivreAnalyzer";
import MercadoLivrePriceCalculator from "./pages/MercadoLivrePriceCalculator";
import MercadoLivreCallback from "./pages/MercadoLivreCallback";
import MercadoLivreFullAnalytics from "./pages/MercadoLivreFullAnalytics";
import MercadoLivreGrowthReport from "./pages/MercadoLivreGrowthReport";
import MercadoLivreVolumeOpportunities from "./pages/MercadoLivreVolumeOpportunities";
import MercadoLivreOperations from "./pages/MercadoLivreOperations";
import MercadoAdsManual from "./pages/MercadoAdsManual";
import Integrations from "./pages/Integrations";
import ShopeeAgora from "./pages/ShopeeAgora";
import Products from "./pages/Products";
import ProductHub from "./pages/ProductHub";
import ProductHubDetail from "./pages/ProductHubDetail";
import FulfillmentManagement from "./pages/FulfillmentManagement";
import { AuthProvider } from "./hooks/useAuth";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { WorkspaceProvider } from "./hooks/useWorkspace";

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
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <WorkspaceProvider>
            <MainLayout>
              <PageViewTracker />
              <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/" element={<RequireAuth><MercadoLivre /></RequireAuth>} />

                <Route path="/gerador-looks" element={<RequireAuth><VirtualTryOn /></RequireAuth>} />
                <Route path="/mercado-livre" element={<RequireAuth><Navigate to="/" replace /></RequireAuth>} />
                <Route path="/mercado-livre/operacoes" element={<RequireAuth><MercadoLivreOperations /></RequireAuth>} />
                <Route path="/mercado-livre-analyzer" element={<RequireAuth><MercadoLivreAnalyzer /></RequireAuth>} />
                <Route path="/mercado-livre-price-calculator" element={<RequireAuth><MercadoLivrePriceCalculator /></RequireAuth>} />
            <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
            <Route path="/integrations/mercadolivre/callback" element={<MercadoLivreCallback />} />
            <Route path="/shopee-agora" element={<RequireAuth><ShopeeAgora /></RequireAuth>} />
            <Route path="/mercado-ads/manual" element={<RequireAuth><MercadoAdsManual /></RequireAuth>} />

                <Route path="/product-hub" element={<RequireAuth><ProductHub /></RequireAuth>} />
                <Route path="/product-hub/:id" element={<RequireAuth><ProductHubDetail /></RequireAuth>} />
                <Route path="/products" element={<RequireAuth><Products /></RequireAuth>} />
                <Route path="/mercado-livre/full-analytics" element={<RequireAuth><MercadoLivreFullAnalytics /></RequireAuth>} />
                <Route path="/mercado-livre/relatorio-executivo" element={<RequireAuth><MercadoLivreGrowthReport /></RequireAuth>} />
                <Route path="/mercado-livre/oportunidades-volume" element={<RequireAuth><MercadoLivreVolumeOpportunities /></RequireAuth>} />
                <Route path="/fulfillment" element={<RequireAuth><FulfillmentManagement /></RequireAuth>} />

                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </MainLayout>
          </WorkspaceProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
