import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Campaigns from "./pages/Campaigns";
import CampaignDetails from "./pages/CampaignDetails";
import AdDetails from "./pages/AdDetails";
import Reports from "./pages/Reports";
import VirtualTryOn from "./pages/VirtualTryOnV2";
import Automations from "./pages/Automations";
import Experiments from "./pages/Experiments";
import InternalChat from "./pages/InternalChat";
import MetaAds from "./pages/MetaAds";
import CreateMetaCampaign from "./pages/CreateMetaCampaign";
import GoogleAnalytics from "./pages/GoogleAnalytics";
import DriveCreatives from "./pages/DriveCreatives";
import NotFound from "./pages/NotFound";
import ProjectManagement from "./pages/ProjectManagementV3";
import FeaturePaused from "./pages/FeaturePaused";
import { useEffect } from "react";
import { gtmPush } from "@/lib/gtm";
import Login from "./pages/Login";
import AdminUsers from "./pages/AdminUsers";
import MercadoLivre from "./pages/MercadoLivre";
import MercadoLivreAnalyzer from "./pages/MercadoLivreAnalyzer";
import MercadoLivrePriceCalculator from "./pages/MercadoLivrePriceCalculator";
import MercadoLivreDescriptionBuilder from "./pages/MercadoLivreDescriptionBuilder";
import MercadoLivreCallback from "./pages/MercadoLivreCallback";
import MercadoLivreFullAnalytics from "./pages/MercadoLivreFullAnalytics";
import Products from "./pages/Products";
import FulfillmentManagement from "./pages/FulfillmentManagement";
import Notifications from "./pages/Notifications";
import { AuthProvider } from "./hooks/useAuth";
import { RequireAuth } from "@/components/layout/RequireAuth";
import { WorkspaceProvider } from "./hooks/useWorkspace";
import { adsFeaturesEnabled, featureFlags } from "@/lib/featureFlags";

const queryClient = new QueryClient();
const adsEnabled = adsFeaturesEnabled;
const metaAdsEnabled = featureFlags.metaAds;
const googleAnalyticsEnabled = featureFlags.googleAnalytics;

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
          <WorkspaceProvider>
            <MainLayout>
              <PageViewTracker />
              <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/" element={<RequireAuth><MercadoLivre /></RequireAuth>} />

                <Route path="/projects" element={<RequireAuth><ProjectManagement /></RequireAuth>}>
                  <Route path="drive-creatives" element={<RequireAuth><DriveCreatives /></RequireAuth>} />
                  <Route path="internal-chat" element={<RequireAuth><InternalChat /></RequireAuth>} />
                </Route>
                {adsEnabled ? (
                  <>
                    <Route path="/campaigns/:campaignId" element={<RequireAuth><CampaignDetails /></RequireAuth>} />
                    <Route path="/ads/:adId" element={<RequireAuth><AdDetails /></RequireAuth>} />
                    <Route path="/campaigns" element={<RequireAuth><Campaigns /></RequireAuth>} />
                    <Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />
                  </>
                ) : (
                  <>
                    <Route
                      path="/campaigns/*"
                      element={
                        <RequireAuth>
                          <FeaturePaused
                            title="Campanhas"
                            enableHint="VITE_FEATURE_META_ADS=true ou VITE_FEATURE_GOOGLE_ADS=true"
                          />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/ads/*"
                      element={
                        <RequireAuth>
                          <FeaturePaused
                            title="Anúncios"
                            enableHint="VITE_FEATURE_META_ADS=true ou VITE_FEATURE_GOOGLE_ADS=true"
                          />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/reports/*"
                      element={
                        <RequireAuth>
                          <FeaturePaused
                            title="Relatórios de Ads"
                            enableHint="VITE_FEATURE_META_ADS=true ou VITE_FEATURE_GOOGLE_ADS=true"
                          />
                        </RequireAuth>
                      }
                    />
                  </>
                )}

                {metaAdsEnabled ? (
                  <Route path="/meta-ads" element={<RequireAuth><MetaAds /></RequireAuth>}>
                    <Route path="reports" element={<RequireAuth><Reports /></RequireAuth>} />
                  </Route>
                ) : (
                  <Route
                    path="/meta-ads/*"
                    element={
                      <RequireAuth>
                        <FeaturePaused title="Meta Ads" enableHint="VITE_FEATURE_META_ADS=true" />
                      </RequireAuth>
                    }
                  />
                )}

                {metaAdsEnabled ? (
                  <Route path="/campaigns/new/meta" element={<RequireAuth><CreateMetaCampaign /></RequireAuth>} />
                ) : (
                  <Route
                    path="/campaigns/new/meta"
                    element={
                      <RequireAuth>
                        <FeaturePaused
                          title="Criação de campanhas Meta"
                          enableHint="VITE_FEATURE_META_ADS=true"
                        />
                      </RequireAuth>
                    }
                  />
                )}

                {googleAnalyticsEnabled ? (
                  <Route path="/google-analytics" element={<RequireAuth><GoogleAnalytics /></RequireAuth>} />
                ) : (
                  <Route
                    path="/google-analytics/*"
                    element={
                      <RequireAuth>
                        <FeaturePaused
                          title="Google Analytics"
                          enableHint="VITE_FEATURE_GOOGLE_ANALYTICS=true"
                        />
                      </RequireAuth>
                    }
                  />
                )}
                {/* legacy route kept for backward compatibility */}
                {/* <Route path="/drive-creatives" element={<RequireAuth><DriveCreatives /></RequireAuth>} /> */}
                <Route path="/gerador-looks" element={<RequireAuth><VirtualTryOn /></RequireAuth>} />
                <Route path="/automations" element={<RequireAuth><Automations /></RequireAuth>} />
                <Route path="/experiments" element={<RequireAuth><Experiments /></RequireAuth>} />
                {/* legacy route kept for backward compatibility */}
                {/* <Route path="/internal-chat" element={<RequireAuth><InternalChat /></RequireAuth>} /> */}
                <Route path="/mercado-livre" element={<RequireAuth><Navigate to="/" replace /></RequireAuth>} />
                <Route path="/mercado-livre-analyzer" element={<RequireAuth><MercadoLivreAnalyzer /></RequireAuth>} />
                <Route path="/mercado-livre-price-calculator" element={<RequireAuth><MercadoLivrePriceCalculator /></RequireAuth>} />
                <Route path="/mercado-livre-descricoes" element={<RequireAuth><MercadoLivreDescriptionBuilder /></RequireAuth>} />
                <Route path="/integrations/mercadolivre/callback" element={<MercadoLivreCallback />} />
                <Route path="/products" element={<RequireAuth><Products /></RequireAuth>} />
                <Route path="/mercado-livre/full-analytics" element={<RequireAuth><MercadoLivreFullAnalytics /></RequireAuth>} />
                <Route path="/fulfillment" element={<RequireAuth><FulfillmentManagement /></RequireAuth>} />

                <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />

                <Route path="/admin/users" element={<RequireAuth><AdminUsers /></RequireAuth>} />

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
