import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Sparkles, FileDown } from "lucide-react";

export default function Tracking() {
  const STORAGE_KEY = "traffic-tracking-defaults";
  const STORAGE_VERSION_KEY = "traffic-tracking-defaults-version";
  const initialDefaults: Record<string, string> = (() => {
    try {
      if (typeof window === "undefined") return {};
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const fromStorage = raw ? JSON.parse(raw) : {};

      // Environment fallbacks (if not present in storage)
      const envDefaults: Record<string, string> = {
        gtmContainerId: (import.meta.env.VITE_GTM_ID as string) || "",
        // Prefer explicit GA4 measurement env, fallback to property id if present
        ga4MeasurementId:
          ((import.meta.env.VITE_GA4_MEASUREMENT_ID as string) || "").trim() ||
          ((import.meta.env.VITE_GA4_PROPERTY_ID as string) || "").trim() ||
          "G-FCC95TVZ29",
        fbPixelId: (import.meta.env.VITE_FB_PIXEL_ID as string) || "343981593131346",
        adsConversionId: (import.meta.env.VITE_AW_CONVERSION_ID as string) || "AW-1988032294",
        awConversionLabelPurchase: (import.meta.env.VITE_AW_LABEL_PURCHASE as string) || "",
        ttPixelId: (import.meta.env.VITE_TT_PIXEL_ID as string) || "",
      };

      // Merge storage over env, then fix placeholders by preferring env
      const merged: Record<string, string> = { ...envDefaults, ...fromStorage };

      const isEmpty = (v: any) => !v || (typeof v === "string" && v.trim() === "");
      const looksPlaceholder = (v: string, prefix: string) => {
        if (isEmpty(v)) return true;
        const val = v.trim();
        if (val.includes("XXXXXXXX")) return true; // generic placeholder check
        return val.startsWith(prefix) && /X/.test(val); // e.g. G-XXXXXXXXXX, AW-XXXXXXXXXX
      };

      // If storage contains placeholders or empties, prefer env defaults
      if (looksPlaceholder(merged.ga4MeasurementId || "", "G-")) {
        merged.ga4MeasurementId = envDefaults.ga4MeasurementId;
      }
      if (looksPlaceholder(merged.adsConversionId || "", "AW-")) {
        merged.adsConversionId = envDefaults.adsConversionId;
      }
      if (looksPlaceholder(merged.ttPixelId || "", "TT-")) {
        merged.ttPixelId = envDefaults.ttPixelId;
      }
      if (isEmpty(merged.fbPixelId)) {
        merged.fbPixelId = envDefaults.fbPixelId;
      }
      if (isEmpty(merged.gtmContainerId)) {
        merged.gtmContainerId = envDefaults.gtmContainerId;
      }

      return merged;
    } catch (_) {
      return {};
    }
  })();

  const [gtmContainerId, setGtmContainerId] = useState<string>(initialDefaults.gtmContainerId || "GTM-N8PFFF7J");
  const [ga4MeasurementId, setGa4MeasurementId] = useState<string>(initialDefaults.ga4MeasurementId || "G-FCC95TVZ29");
  const [fbPixelId, setFbPixelId] = useState<string>(initialDefaults.fbPixelId || "343981593131346");
  const [adsConversionId, setAdsConversionId] = useState<string>(initialDefaults.adsConversionId || "AW-1988032294");
  const [awConversionLabelPurchase, setAwConversionLabelPurchase] = useState<string>(initialDefaults.awConversionLabelPurchase || "AW-CONVERSION-LABEL-PURCHASE");
  const [ttPixelId, setTtPixelId] = useState<string>(initialDefaults.ttPixelId || "TT-XXXXXXXXXX");
  const hasHydratedEnvDefaults = useRef(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const payload = {
        gtmContainerId,
        ga4MeasurementId,
        fbPixelId,
        adsConversionId,
        awConversionLabelPurchase,
        ttPixelId,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {
      // noop
    }
  }, [gtmContainerId, ga4MeasurementId, fbPixelId, adsConversionId, awConversionLabelPurchase, ttPixelId]);

  // Migração em uma vez: aplicar padrões do ambiente e persistir
  useEffect(() => {
    if (hasHydratedEnvDefaults.current) {
      return;
    }
    hasHydratedEnvDefaults.current = true;

    try {
      if (typeof window === "undefined") return;
      const version = window.localStorage.getItem(STORAGE_VERSION_KEY);
      if (version === "2") return;

      const envDefaults = {
        gtmContainerId: (import.meta as any)?.env?.VITE_GTM_ID || "GTM-N8PFFF7J",
        ga4MeasurementId:
          ((import.meta as any)?.env?.VITE_GA4_MEASUREMENT_ID || "").trim() ||
          ((import.meta as any)?.env?.VITE_GA4_PROPERTY_ID || "").trim() ||
          "G-FCC95TVZ29",
        fbPixelId: (import.meta as any)?.env?.VITE_FB_PIXEL_ID || "343981593131346",
        adsConversionId: (import.meta as any)?.env?.VITE_AW_CONVERSION_ID || "AW-1988032294",
        awConversionLabelPurchase: (import.meta as any)?.env?.VITE_AW_LABEL_PURCHASE || "AW-CONVERSION-LABEL-PURCHASE",
        ttPixelId: (import.meta as any)?.env?.VITE_TT_PIXEL_ID || "TT-XXXXXXXXXX",
      };

      setGtmContainerId((prev: string) => envDefaults.gtmContainerId || prev);
      setGa4MeasurementId((prev: string) => envDefaults.ga4MeasurementId || prev);
      setFbPixelId((prev: string) => envDefaults.fbPixelId || prev);
      setAdsConversionId((prev: string) => envDefaults.adsConversionId || prev);
      setAwConversionLabelPurchase((prev: string) => envDefaults.awConversionLabelPurchase || prev);
      setTtPixelId((prev: string) => envDefaults.ttPixelId || prev);

      const next = {
        gtmContainerId: envDefaults.gtmContainerId || gtmContainerId,
        ga4MeasurementId: envDefaults.ga4MeasurementId || ga4MeasurementId,
        fbPixelId: envDefaults.fbPixelId || fbPixelId,
        adsConversionId: envDefaults.adsConversionId || adsConversionId,
        awConversionLabelPurchase: envDefaults.awConversionLabelPurchase || awConversionLabelPurchase,
        ttPixelId: envDefaults.ttPixelId || ttPixelId,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.localStorage.setItem(STORAGE_VERSION_KEY, "2");
    } catch (_) {
      // noop
    }
  }, [adsConversionId, awConversionLabelPurchase, fbPixelId, ga4MeasurementId, gtmContainerId, ttPixelId]);

  function downloadText(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildGtmContainerPackage(): string {
    const ids = {
      gtm: gtmContainerId || "GTM-XXXXXXX",
      fb: fbPixelId || "000000000000000",
      ga: ga4MeasurementId || "G-XXXXXXXXXX",
      aw: adsConversionId || "AW-XXXXXXXXXX",
      tt: ttPixelId || "TT-XXXXXXXXXX",
      awLabelPurchase: awConversionLabelPurchase || "AW-CONVERSION-LABEL-PURCHASE",
    };

    const vars = {
      // Data Layer
      dlValue: "301",
      dlCurrency: "302",
      dlItems: "303",
      dlContentIds: "304",
      // UTM
      utmSource: "401",
      utmMedium: "402",
      utmCampaign: "403",
      utmTerm: "404",
      utmContent: "405",
      // Constantes
      PIXEL_ID: "501",
      GA_MEASUREMENT_ID: "502",
      AW_CONVERSION_ID: "503",
      AW_CONVERSION_LABEL_PURCHASE: "504",
      TT_PIXEL_ID: "505",
    } as const;

    const trg = {
      allPages: "101",
      evViewContent: "102",
      evAddToCart: "103",
      evBeginCheckout: "104",
      evPurchase: "105",
      evViewItem: "106",
      linkWhatsapp: "107",
    } as const;

    const htmlMetaBase = `<!-- Meta Pixel Base -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)n=_fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','{{PIXEL_ID}}');
fbq('track','PageView');
</script>`;

    const htmlMetaViewContent = `<!-- Meta ViewContent -->
<script>
try {
  var ids = {{dl.content_ids}} || [];
  fbq('track','ViewContent',{ content_ids: Array.isArray(ids)?ids:[ids] });
} catch(e) { /* noop */ }
</script>`;

    const htmlMetaAddToCart = `<!-- Meta AddToCart -->
<script>
try {
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  fbq('track','AddToCart',{ value: Number(value||0), currency: currency });
} catch(e) { /* noop */ }
</script>`;

    const htmlMetaBeginCheckout = `<!-- Meta InitiateCheckout -->
<script>
try {
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  fbq('track','InitiateCheckout',{ value: Number(value||0), currency: currency });
} catch(e) { /* noop */ }
</script>`;

    const htmlMetaPurchase = `<!-- Meta Purchase -->
<script>
try {
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  fbq('track','Purchase',{ value: Number(value||0), currency: currency });
} catch(e) { /* noop */ }
</script>`;

    const htmlMetaWhatsApp = `<!-- Meta WhatsApp Click -->
<script>
try {
  var href = {{Click URL}} || '';
  fbq('trackCustom','WhatsAppClick',{ url: href });
} catch(e) { /* noop */ }
</script>`;

    const htmlGa4Config = `<!-- GA4 Config -->
<script async src="https://www.googletagmanager.com/gtag/js?id={{GA_MEASUREMENT_ID}}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);} 
gtag('js', new Date());
gtag('config','{{GA_MEASUREMENT_ID}}');
</script>`;

    const htmlGa4Purchase = `<!-- GA4 Purchase -->
<script>
try {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);} 
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  gtag('event','purchase',{ value: Number(value||0), currency: currency });
} catch(e) { /* noop */ }
</script>`;

    const htmlGa4ViewItem = `<!-- GA4 View Item -->
<script>
try {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);} 
  var items = {{dl.items}};
  gtag('event','view_item',{ items: items });
} catch(e) { /* noop */ }
</script>`;

    const htmlGa4AddToCart = `<!-- GA4 Add To Cart -->
<script>
try {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);} 
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  var items = {{dl.items}};
  gtag('event','add_to_cart',{ value: Number(value||0), currency: currency, items: items });
} catch(e) { /* noop */ }
</script>`;

    const htmlGa4BeginCheckout = `<!-- GA4 Begin Checkout -->
<script>
try {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);} 
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  var items = {{dl.items}};
  gtag('event','begin_checkout',{ value: Number(value||0), currency: currency, items: items });
} catch(e) { /* noop */ }
</script>`;

    const htmlAdsConfig = `<!-- Google Ads Config -->
<script async src="https://www.googletagmanager.com/gtag/js?id={{AW_CONVERSION_ID}}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);} 
gtag('js', new Date());
gtag('config','{{AW_CONVERSION_ID}}');
</script>`;

    const htmlAdsPurchase = `<!-- Google Ads Purchase Conversion -->
<script>
try {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);} 
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  gtag('event','conversion',{ send_to: '{{AW_CONVERSION_ID}}/{{AW_CONVERSION_LABEL_PURCHASE}}', value: Number(value||0), currency: currency });
} catch(e) { /* noop */ }
</script>`;

    const htmlTiktokBase = `<!-- TikTok Pixel Base -->
<script>
!function (w, d, t) {
  w.TiktokAnalyticsObject = t;
  var ttq = w[t] = w[t] || [];
  ttq.methods = ['page','track','identify','instances','debug','on','off','upload'];
  ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
  for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
  ttq.instance = function (t) { var e = ttq; return e._i || (e._i = {}), e._i[t] || (e._i[t] = []), e._i[t] };
  ttq.load = function (e, n) {
    var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
    ttq._t = ttq._t || {}; ttq._t[e] = n || {}; var o = document.createElement('script'); o.type = 'text/javascript'; o.async = !0; o.src = i;
    var a = document.getElementsByTagName('script')[0]; a.parentNode.insertBefore(o, a);
  };
  ttq.load('{{TT_PIXEL_ID}}'); ttq.page();
}(window, document, 'ttq');
</script>`;

    const htmlTiktokPurchase = `<!-- TikTok Purchase -->
<script>
try {
  var value = {{dl.value}};
  var currency = {{dl.currency}} || 'BRL';
  ttq.track('CompletePayment', { value: Number(value||0), currency: currency });
} catch(e) { /* noop */ }
</script>`;

    const container = {
      exportFormatVersion: 2,
      exportTime: new Date().toISOString(),
      containerVersion: {
        container: {
          publicId: ids.gtm,
          name: "Vermezzo Hub – Completo",
          usageContext: ["WEB"],
        },
        builtInVariable: [
          { type: "PAGE_URL" },
          { type: "PAGE_HOSTNAME" },
          { type: "PAGE_PATH" },
          { type: "REFERRER" },
          { type: "EVENT" },
          { type: "CLICK_ELEMENT" },
          { type: "CLICK_CLASSES" },
          { type: "CLICK_ID" },
          { type: "CLICK_TARGET" },
          { type: "CLICK_URL" },
          { type: "CLICK_TEXT" },
        ],
        variable: [
          // Data Layer
          { name: "dl.value", type: "DATA_LAYER", parameter: [{ key: "name", type: "TEMPLATE", value: "value" }] },
          { name: "dl.currency", type: "DATA_LAYER", parameter: [{ key: "name", type: "TEMPLATE", value: "currency" }] },
          { name: "dl.items", type: "DATA_LAYER", parameter: [{ key: "name", type: "TEMPLATE", value: "items" }] },
          { name: "dl.content_ids", type: "DATA_LAYER", parameter: [{ key: "name", type: "TEMPLATE", value: "content_ids" }] },
          // UTM
          { name: "utm_source", type: "URL", parameter: [{ key: "component", type: "TEMPLATE", value: "QUERY" }, { key: "queryKey", type: "TEMPLATE", value: "utm_source" }] },
          { name: "utm_medium", type: "URL", parameter: [{ key: "component", type: "TEMPLATE", value: "QUERY" }, { key: "queryKey", type: "TEMPLATE", value: "utm_medium" }] },
          { name: "utm_campaign", type: "URL", parameter: [{ key: "component", type: "TEMPLATE", value: "QUERY" }, { key: "queryKey", type: "TEMPLATE", value: "utm_campaign" }] },
          { name: "utm_term", type: "URL", parameter: [{ key: "component", type: "TEMPLATE", value: "QUERY" }, { key: "queryKey", type: "TEMPLATE", value: "utm_term" }] },
          { name: "utm_content", type: "URL", parameter: [{ key: "component", type: "TEMPLATE", value: "QUERY" }, { key: "queryKey", type: "TEMPLATE", value: "utm_content" }] },
          // Constantes
          { name: "PIXEL_ID", type: "CONSTANT", parameter: [{ key: "value", type: "TEMPLATE", value: ids.fb }] },
          { name: "GA_MEASUREMENT_ID", type: "CONSTANT", parameter: [{ key: "value", type: "TEMPLATE", value: ids.ga }] },
          { name: "AW_CONVERSION_ID", type: "CONSTANT", parameter: [{ key: "value", type: "TEMPLATE", value: ids.aw }] },
          { name: "AW_CONVERSION_LABEL_PURCHASE", type: "CONSTANT", parameter: [{ key: "value", type: "TEMPLATE", value: ids.awLabelPurchase }] },
          { name: "TT_PIXEL_ID", type: "CONSTANT", parameter: [{ key: "value", type: "TEMPLATE", value: ids.tt }] },
        ],
        trigger: [
          { triggerId: trg.allPages, name: "All Pages", type: "PAGEVIEW" },
          { triggerId: trg.evViewContent, name: "view_content", type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [{ key: "arg0", type: "TEMPLATE", value: "{{_event}}" }, { key: "arg1", type: "TEMPLATE", value: "view_content" }] }] },
          { triggerId: trg.evAddToCart, name: "add_to_cart", type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [{ key: "arg0", type: "TEMPLATE", value: "{{_event}}" }, { key: "arg1", type: "TEMPLATE", value: "add_to_cart" }] }] },
          { triggerId: trg.evBeginCheckout, name: "begin_checkout", type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [{ key: "arg0", type: "TEMPLATE", value: "{{_event}}" }, { key: "arg1", type: "TEMPLATE", value: "begin_checkout" }] }] },
          { triggerId: trg.evPurchase, name: "purchase", type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [{ key: "arg0", type: "TEMPLATE", value: "{{_event}}" }, { key: "arg1", type: "TEMPLATE", value: "purchase" }] }] },
          { triggerId: trg.evViewItem, name: "view_item", type: "CUSTOM_EVENT", customEventFilter: [{ type: "EQUALS", parameter: [{ key: "arg0", type: "TEMPLATE", value: "{{_event}}" }, { key: "arg1", type: "TEMPLATE", value: "view_item" }] }] },
          { triggerId: trg.linkWhatsapp, name: "url_wpp", type: "LINK_CLICK", filter: [{ type: "CONTAINS", parameter: [{ key: "arg0", type: "TEMPLATE", value: "{{Click URL}}" }, { key: "arg1", type: "TEMPLATE", value: "https://api.whatsapp.com/send?phone=5513997792813" }] }], waitForTags: { type: "BOOLEAN", value: "false" }, checkValidation: { type: "BOOLEAN", value: "false" }, waitForTagsTimeout: { type: "TEMPLATE", value: "2000" } },
        ],
        tag: [
          // Meta
          { tagId: "201", name: "Meta Pixel – Base", type: "html", firingTriggerId: [trg.allPages], parameter: [{ key: "html", type: "TEMPLATE", value: htmlMetaBase }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "202", name: "Meta Pixel – ViewContent", type: "html", firingTriggerId: [trg.evViewContent], parameter: [{ key: "html", type: "TEMPLATE", value: htmlMetaViewContent }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "203", name: "Meta Pixel – AddToCart", type: "html", firingTriggerId: [trg.evAddToCart], parameter: [{ key: "html", type: "TEMPLATE", value: htmlMetaAddToCart }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "204", name: "Meta Pixel – InitiateCheckout", type: "html", firingTriggerId: [trg.evBeginCheckout], parameter: [{ key: "html", type: "TEMPLATE", value: htmlMetaBeginCheckout }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "205", name: "Meta Pixel – Purchase", type: "html", firingTriggerId: [trg.evPurchase], parameter: [{ key: "html", type: "TEMPLATE", value: htmlMetaPurchase }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "206", name: "Meta Pixel – WhatsApp", type: "html", firingTriggerId: [trg.linkWhatsapp], parameter: [{ key: "html", type: "TEMPLATE", value: htmlMetaWhatsApp }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          // GA4
          { tagId: "301", name: "GA4 – Config", type: "googtag", firingTriggerId: [trg.allPages], parameter: [{ key: "tagId", type: "TEMPLATE", value: "{{GA_MEASUREMENT_ID}}" }, { key: "sendPageView", type: "BOOLEAN", value: "true" }] },
          { tagId: "302", name: "GA4 – Purchase", type: "gaawe", firingTriggerId: [trg.evPurchase], parameter: [{ key: "eventName", type: "TEMPLATE", value: "purchase" }] },
          { tagId: "303", name: "GA4 – ViewItem", type: "gaawe", firingTriggerId: [trg.evViewItem], parameter: [{ key: "eventName", type: "TEMPLATE", value: "view_item" }] },
          { tagId: "304", name: "GA4 – AddToCart", type: "gaawe", firingTriggerId: [trg.evAddToCart], parameter: [{ key: "eventName", type: "TEMPLATE", value: "add_to_cart" }] },
          { tagId: "305", name: "GA4 – BeginCheckout", type: "gaawe", firingTriggerId: [trg.evBeginCheckout], parameter: [{ key: "eventName", type: "TEMPLATE", value: "begin_checkout" }] },
          // Google Ads
          { tagId: "401", name: "Ads – Config (AW)", type: "html", firingTriggerId: [trg.allPages], parameter: [{ key: "html", type: "TEMPLATE", value: htmlAdsConfig }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "402", name: "Ads – Purchase Conversion", type: "html", firingTriggerId: [trg.evPurchase], parameter: [{ key: "html", type: "TEMPLATE", value: htmlAdsPurchase }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          // TikTok
          { tagId: "501", name: "TikTok – Base", type: "html", firingTriggerId: [trg.allPages], parameter: [{ key: "html", type: "TEMPLATE", value: htmlTiktokBase }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
          { tagId: "502", name: "TikTok – Purchase", type: "html", firingTriggerId: [trg.evPurchase], parameter: [{ key: "html", type: "TEMPLATE", value: htmlTiktokPurchase }, { key: "supportDocumentWrite", type: "BOOLEAN", value: "false" }] },
        ],
      },
    };

    return JSON.stringify(container, null, 2);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Gerador de Contêiner GTM</h1>
      </div>

      <Card>
        <CardContent className="py-4 space-y-4">
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Importe e crie tudo de uma vez</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Pacote de Contêiner (JSON)</AlertTitle>
                <AlertDescription>
                  Compatível com importação do GTM. Inclui Tags Meta, GA4, Google Ads e TikTok, Variáveis dataLayer e UTM, e Acionadores essenciais.
                </AlertDescription>
              </Alert>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>GTM Container ID (opcional)</Label>
                  <Input value={gtmContainerId} onChange={(e) => setGtmContainerId(e.target.value)} placeholder="GTM-XXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>GA4 Measurement ID</Label>
                  <Input value={ga4MeasurementId} onChange={(e) => setGa4MeasurementId(e.target.value)} placeholder="G-XXXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Facebook Pixel ID</Label>
                  <Input value={fbPixelId} onChange={(e) => setFbPixelId(e.target.value)} placeholder="000000000000000" />
                </div>
                <div className="space-y-2">
                  <Label>Google Ads Conversion ID (AW)</Label>
                  <Input value={adsConversionId} onChange={(e) => setAdsConversionId(e.target.value)} placeholder="AW-XXXXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>AW Conversion Label (Purchase)</Label>
                  <Input value={awConversionLabelPurchase} onChange={(e) => setAwConversionLabelPurchase(e.target.value)} placeholder="AW-CONVERSION-LABEL-PURCHASE" />
                </div>
                <div className="space-y-2">
                  <Label>TikTok Pixel ID</Label>
                  <Input value={ttPixelId} onChange={(e) => setTtPixelId(e.target.value)} placeholder="TT-XXXXXXXXXX" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(buildGtmContainerPackage())}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar contêiner
                </Button>
                <Button size="sm" onClick={() => downloadText("gtm-container-trafficpro.json", buildGtmContainerPackage())}>
                  <FileDown className="h-3 w-3 mr-1" /> Baixar contêiner
                </Button>
              </div>
              <Textarea rows={18} value={buildGtmContainerPackage()} readOnly />
              <p className="text-xs text-muted-foreground">GTM → Admin → Import Container. Recomendo "Merge" + "Rename conflicts".</p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
