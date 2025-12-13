import { useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Wand2,
  Clipboard,
  ShieldCheck,
  PackagePlus,
} from "lucide-react";

type ProductType = {
  key: string;
  label: string;
  focus: string;
};

const productTypes: ProductType[] = [
  { key: "anel", label: "Anel", focus: "aro, ajuste, conforto e banho" },
  { key: "colar", label: "Colar", focus: "corrente, fecho, peso e queda" },
  { key: "brinco", label: "Brinco", focus: "tarraxa, peso, banho e antialérgico" },
  { key: "pulseira", label: "Pulseira/Bracelete", focus: "comprimento, ajuste e segurança" },
  { key: "carteira", label: "Carteira", focus: "capacidade, divisórias e acabamento" },
  { key: "outros", label: "Outro acessório", focus: "material, uso e sensação" },
];

const complianceChecklist = [
  "Sem links, contatos ou @ na descrição.",
  "Não prometa garantia extra se não existir política ativa.",
  "Evite termos proibidos (réplica, inspired, banhos milagrosos).",
  "Sempre cite material e acabamento para reduzir devoluções.",
  "Inclua medidas claras (cm/mm) e variações disponíveis.",
  "Explique cuidados e forma de envio para evitar reclamações.",
];

const defaultCare =
  "Evite contato direto com água, suor intenso e produtos químicos; Após usar, limpe com flanela seca; Guarde separado de outras peças para evitar atrito.";

const defaultShipping =
  "Seg a sex: pedidos até 12h saem no mesmo dia; Sáb/Dom/Feriados: envio no próximo dia útil;";

const defaultKit = "01 unidade embalada e pronta para presente.";

const parseList = (value: string) =>
  value
    .split(/[\n;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const joinList = (value?: string[] | string) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join("\n");
  }
  return value || "";
};

export default function MercadoLivreDescriptionBuilder() {
  const [productName, setProductName] = useState("");
  const [productType, setProductType] = useState<ProductType>(productTypes[0]);
  const [brand, setBrand] = useState("Outras");
  const [materials, setMaterials] = useState<string[]>([]);
  const [design, setDesign] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [fit, setFit] = useState<string[]>([]);
  const [differentials, setDifferentials] = useState("");
  const [usageContext, setUsageContext] = useState<string[]>([]);
  const [kit, setKit] = useState(defaultKit);
  const [care, setCare] = useState(defaultCare);
  const [shipping, setShipping] = useState(defaultShipping);
  const [keywords, setKeywords] = useState("");

  const brandOptions = ["Outras", "Genérica", "Vermezzo", "Sem marca", "Artesanal", "Marca própria"];
  const materialOptions = ["Aço inox", "Aço Inoxidável", "Metal Nobre", "Latão folheado ouro 18k", "Prata 925", "Zamac banhado", "Couro legítimo"];
  const colorOptions = ["Dourado", "Prateado", "Rosé", "Preto", "Natural"];
  const designOptions = ["Espiral", "Argola", "Pingente coração", "Corrente fina", "Trançada"];
  const sizeOptions = ["Ajustável", "Aro 16", "Aro 17", "Aro 18", "Aro 19", "45 cm", "50 cm", "Único", "17", "18", "19", "20", "21"];
  const fitOptions = ["Ajustável", "Leve", "Anatômico", "Antialérgico"];
  const usageOptions = ["Uso diário", "Presente", "Trabalho", "Festa", "Casual"];
  const differentialOptions = [
    "Não escurece fácil",
    "Ajustável",
    "Antialérgico",
    "Fecho seguro",
    "Extensor ajustável",
    "Leve",
    "Acabamento premium",
    "Pingente delicado",
    "Tarraxa confortável",
    "Alta durabilidade",
  ];
  const [selectedDifferentials, setSelectedDifferentials] = useState<string[]>([]);

  const categorySuggestions: Record<string, Partial<{
    materials: string[];
    colors: string[];
    design: string;
    sizes: string[];
    fit: string[];
    usageContext: string[];
    differentials: string[];
    kit: string[];
    care: string[];
    shipping: string[];
    keywords: string[];
  }>> = {
    anel: {
      materials: ["Latão folheado ouro 18k"],
      colors: ["Dourado"],
      design: "Espiral com 6 voltas",
      sizes: ["Ajustável"],
      fit: ["Ajustável", "Leve"],
      usageContext: ["Uso diário", "Presente"],
      differentials: ["Não escurece fácil", "Ajustável", "Antialérgico"],
      kit: [defaultKit],
      care: parseList(defaultCare),
      shipping: parseList(defaultShipping),
      keywords: ["anel dourado", "ajustável", "joia feminina", "presente"],
    },
    colar: {
      materials: ["Aço inox"],
      colors: ["Prateado"],
      design: "Corrente fina com pingente",
      sizes: ["45 cm", "Extensor 5 cm"],
      fit: ["Leve"],
      usageContext: ["Dia a dia", "Festa"],
      differentials: ["Não oxida fácil", "Pingente delicado"],
      kit: [defaultKit],
      care: parseList(defaultCare),
      shipping: parseList(defaultShipping),
      keywords: ["colar aço inox", "corrente fina", "pingente", "presente"],
    },
    brinco: {
      materials: ["Zamac banhado"],
      colors: ["Rosé"],
      design: "Argola média",
      sizes: ["Único"],
      fit: ["Antialérgico", "Leve"],
      usageContext: ["Casual", "Festa"],
      differentials: ["Tarraxa confortável", "Acabamento premium"],
      kit: [defaultKit],
      care: parseList(defaultCare),
      shipping: parseList(defaultShipping),
      keywords: ["brinco argola", "rosé", "antialérgico"],
    },
    pulseira: {
      materials: ["Aço inox"],
      colors: ["Dourado"],
      design: "Corrente trançada",
      sizes: ["Único", "Extensor"],
      fit: ["Leve", "Anatômico"],
      usageContext: ["Uso diário"],
      differentials: ["Fecho seguro", "Extensor ajustável"],
      kit: [defaultKit],
      care: parseList(defaultCare),
      shipping: parseList(defaultShipping),
      keywords: ["pulseira dourada", "trançada", "ajustável"],
    },
    carteira: {
      materials: ["Couro legítimo"],
      colors: ["Natural"],
      design: "Múltiplas divisórias",
      sizes: ["Único"],
      fit: ["Compacta"],
      usageContext: ["Trabalho", "Dia a dia"],
      differentials: ["Costura reforçada", "Alta durabilidade"],
      kit: [defaultKit],
      care: ["Hidratar o couro periodicamente", "Evitar umidade excessiva"],
      shipping: parseList(defaultShipping),
      keywords: ["carteira couro", "divisórias", "compacta"],
    },
    outros: {
      materials: ["Aço inox"],
      colors: ["Prateado"],
      design: "Minimalista",
      sizes: ["Único"],
      fit: ["Leve"],
      usageContext: ["Uso diário"],
      differentials: ["Acabamento premium"],
      kit: [defaultKit],
      care: parseList(defaultCare),
      shipping: parseList(defaultShipping),
      keywords: ["acessório", "minimalista", "presente"],
    },
  };

  const applyCategorySuggestion = () => {
    const s = categorySuggestions[productType.key] || {};
    if (s.materials) setMaterials(s.materials);
    if (s.colors) setColors(s.colors);
    if (s.design) setDesign(s.design);
    if (s.sizes) setSizes(s.sizes);
    if (s.fit) setFit(s.fit);
    if (s.usageContext) setUsageContext(s.usageContext);
    if (s.differentials) setDifferentials(joinList(s.differentials));
    if (s.differentials) setSelectedDifferentials(Array.isArray(s.differentials) ? s.differentials : []);
    if (s.kit) setKit(joinList(s.kit));
    if (s.care) setCare(joinList(s.care));
    if (s.shipping) setShipping(joinList(s.shipping));
    if (s.keywords) setKeywords(joinList(s.keywords));
    toast({ title: "Sugestão aplicada", description: "Campos ajustados conforme a categoria." });
  };

  const preview = useMemo(() => {
    const materialsText = Array.isArray(materials) ? materials.join(", ") : String(materials || "");
    const colorsText = Array.isArray(colors) ? colors.join(", ") : String(colors || "");
    const sizesText = Array.isArray(sizes) ? sizes.join(", ") : String(sizes || "");
    const fitText = Array.isArray(fit) ? fit.join(", ") : String(fit || "");
    const usageText = Array.isArray(usageContext) ? usageContext.join(", ") : String(usageContext || "");
    const features = [
      { label: "Marca", value: brand || "—" },
      { label: "Material", value: materialsText },
      { label: "Cor/Acabamento", value: colorsText },
      { label: "Formato/Design", value: design },
      { label: "Tamanhos/Medidas", value: sizesText },
      { label: "Ajuste/Conforto", value: fitText },
    ].filter((item) => item.value);

    const kitList = parseList(kit);
    const careList = parseList(care);
    const shippingList = parseList(shipping).filter((item) => {
      const norm = item.replace(/[.;]/g, "").trim().toLowerCase();
      if (norm === "embalado em plástico bolha e caixa reforçada") return false;
      if (norm.includes("embalag")) return false;
      return true;
    });
    const highlightList = Array.from(new Set([...(selectedDifferentials || []), ...parseList(differentials)]));

    const typeLabel = productType?.label || "Acessório";
    const baseName = productName || `Seu ${typeLabel.toLowerCase()}`;

    const introHead = [baseName, design].filter(Boolean).join(" ");
    const introTail = [materialsText ? `em ${materialsText}` : "", colorsText].filter(Boolean).join(", ");
    const qualifiers = [fitText, usageText ? `ideal para ${usageText}` : ""].filter(Boolean).join("; ");
    const introSentence = [[introHead, introTail].filter(Boolean).join(" "), qualifiers].filter(Boolean).join("; ");

    const descriptionParagraph = [
      introSentence ? `${introSentence}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const featureBlock =
      features.length > 0
        ? ["Características:", ...features.map((f) => `• ${f.label}: ${f.value}`)].join("\n")
        : "";

    const kitBlock = kitList.length > 0 ? ["Acompanha:", ...kitList.map((item) => `• ${item}`)].join("\n") : "";
    const differentialsBlock =
      highlightList.length > 0 ? ["Diferenciais:", ...highlightList.map((item) => `• ${item}`)].join("\n") : "";
    const careBlock = careList.length > 0 ? ["Cuidados:", ...careList.map((item) => `• ${item}`)].join("\n") : "";
    const shippingBlock =
      shippingList.length > 0 ? ["Envio:", ...shippingList.map((item) => `• ${item}`)].join("\n") : "";

    const sections = [descriptionParagraph, featureBlock, kitBlock, differentialsBlock, careBlock, shippingBlock].filter(
      Boolean,
    );

    return sections.join("\n\n");
  }, [brand, care, colors, design, differentials, fit, materials, kit, productName, productType, shipping, sizes, usageContext, selectedDifferentials]);



  const handleCopy = async () => {
    if (!preview) {
      toast({
        title: "Preencha algo antes",
        description: "Adicione nome, material, medidas ou diferenciais para gerar a descrição.",
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(preview);
      toast({
        title: "Descrição copiada",
        description: "Cole no campo de descrição do anúncio no Mercado Livre.",
      });
    } catch (error) {
      toast({
        title: "Não foi possível copiar",
        description: "Copie manualmente o texto abaixo.",
        variant: "destructive",
      });
    }
  };

  const handleCopyKeywords = async () => {
    const list = parseList(keywords);
    const text = list.join(", ");
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Tags copiadas", description: "Cole as tags no campo de palavras‑chave." });
    } catch {
      toast({ title: "Não foi possível copiar as tags", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <Card className="border-0 bg-gradient-to-r from-amber-500/90 via-orange-500/80 to-rose-500/80 text-white shadow-lg">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs uppercase tracking-wide">
                <Sparkles className="h-4 w-4" />
                assistente de descrição para Mercado Livre
              </div>
              <h1 className="text-3xl md:text-4xl font-bold">Construa descrições que convertem</h1>
              <p className="max-w-2xl text-sm md:text-base text-white/80">
                Use blocos padrão (características, acompanha, cuidados e envio) sem engessar o texto. Cada produto
                ganha seu tom, mas segue os pilares que o Mercado Livre exige.
              </p>
              <div className="flex flex-wrap gap-2 text-xs md:text-sm">
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Evite devoluções com medidas claras
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Fale de material e acabamento sempre
                </Badge>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Prepare blocos para qualquer categoria
                </Badge>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-xl bg-white/10 p-4 text-sm backdrop-blur">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                <span className="font-semibold">Checklist Mercado Livre</span>
              </div>
              <ul className="space-y-1 text-white/85">
                {complianceChecklist.slice(0, 3).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-white/70">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Separator className="border-white/20" />
              <ul className="space-y-1 text-white/85">
                {complianceChecklist.slice(3).map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-white/70">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Dados essenciais do anúncio</CardTitle>
                <CardDescription>Preencha o mínimo para gerar um corpo de descrição coerente.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={applyCategorySuggestion} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  Sugestão por categoria
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setCare(defaultCare);
                    setShipping(defaultShipping);
                    setKit(defaultKit);
                  }}
                >
                  <PackagePlus className="h-4 w-4" />
                  Restaurar blocos padrão
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-6">
                {/* Top Section: Name and Category */}
                <div className="grid gap-6 md:grid-cols-1 custom-header-section">
                  <div className="space-y-3">
                    <Label htmlFor="productName" className="text-base font-semibold">Nome do Produto</Label>
                    <Input
                      id="productName"
                      placeholder="Ex.: Anel Ondas Douradas Ajustável com Zircônias"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="text-lg py-6 shadow-sm border-muted-foreground/20"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Categoria</Label>
                    <div className="flex flex-wrap gap-2">
                      {productTypes.map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => setProductType(type)}
                          className={cn(
                            "rounded-full border px-4 py-2 text-sm font-medium transition-all shadow-sm",
                            productType.key === type.key
                              ? "border-amber-600 bg-amber-100 text-amber-900 ring-1 ring-amber-500/30"
                              : "border-border bg-white hover:border-amber-300 hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          {type.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Separator className="bg-border" />

                {/* Main 4-Column Grid: Organized by Context */}
                <div className="grid gap-8 items-start md:grid-cols-2 lg:grid-cols-4 pt-2">

                  {/* Column 1: Identity & Usage */}
                  <div className="space-y-6">
                    <div className="space-y-4 rounded-lg border border-border/40 bg-muted/20 p-4">
                      <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <span className="w-1 h-4 bg-amber-500 rounded-full"></span>
                        Configuração
                      </h3>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="brand" className="text-xs font-medium text-muted-foreground uppercase">Marca</Label>
                          <Select value={brand} onValueChange={setBrand}>
                            <SelectTrigger id="brand" className="bg-background">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {brandOptions.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="design" className="text-xs font-medium text-muted-foreground uppercase">Design</Label>
                          <Select value={design} onValueChange={setDesign}>
                            <SelectTrigger id="design" className="bg-background">
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              {designOptions.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 px-1">
                      <Label className="text-sm font-semibold text-foreground">Ocasião Ideal</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {usageOptions.map((o) => {
                          const checked = usageContext.includes(o);
                          return (
                            <label key={o} className="flex items-center gap-2 cursor-pointer group select-none">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(c) => {
                                  setUsageContext((prev) => {
                                    const next = new Set(prev);
                                    if (c) next.add(o); else next.delete(o);
                                    return Array.from(next);
                                  });
                                }}
                                className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                              />
                              <span className={cn("text-sm transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{o}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Material & Color */}
                  <div className="space-y-6">
                    <div className="space-y-3 px-1">
                      <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                        Material & Acabamento
                      </Label>

                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Material Base</Label>
                          <div className="grid grid-cols-1 gap-2.5">
                            {materialOptions.map((o) => {
                              const checked = materials.includes(o);
                              return (
                                <label key={o} className="flex items-center gap-2 cursor-pointer group select-none">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      setMaterials((prev) => {
                                        const next = new Set(prev);
                                        if (c) next.add(o); else next.delete(o);
                                        return Array.from(next);
                                      });
                                    }}
                                    className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                  />
                                  <span className={cn("text-sm transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{o}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Cor Principal</Label>
                          <div className="grid grid-cols-1 gap-2.5">
                            {colorOptions.map((o) => {
                              const checked = colors.includes(o);
                              return (
                                <label key={o} className="flex items-center gap-2 cursor-pointer group select-none">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      setColors((prev) => {
                                        const next = new Set(prev);
                                        if (c) next.add(o); else next.delete(o);
                                        return Array.from(next);
                                      });
                                    }}
                                    className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                  />
                                  <span className={cn("text-sm transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{o}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Measurements */}
                  <div className="space-y-6">
                    <div className="space-y-3 px-1">
                      <Label className="text-sm font-semibold text-foreground">Medidas & Ajuste</Label>

                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Tamanhos Disponíveis</Label>
                          <div className="grid grid-cols-1 gap-2.5 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {(productType.key === "anel"
                              ? ["Ajustável", "Aro 16", "Aro 17", "Aro 18", "Aro 19", "17", "18", "19", "20", "21"]
                              : productType.key === "colar"
                                ? ["45 cm", "50 cm", "Extensor 5 cm", "Ajustável"]
                                : productType.key === "pulseira"
                                  ? ["Único", "Extensor", "Ajustável"]
                                  : sizeOptions
                            ).map((o) => {
                              const checked = sizes.includes(o);
                              return (
                                <label key={o} className="flex items-center gap-2 cursor-pointer group select-none">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      setSizes((prev) => {
                                        const next = new Set(prev);
                                        if (c) next.add(o); else next.delete(o);
                                        return Array.from(next);
                                      });
                                    }}
                                    className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                  />
                                  <span className={cn("text-sm transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{o}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Tipo de Ajuste</Label>
                          <div className="grid grid-cols-1 gap-2.5">
                            {fitOptions.map((o) => {
                              const checked = fit.includes(o);
                              return (
                                <label key={o} className="flex items-center gap-2 cursor-pointer group select-none">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      setFit((prev) => {
                                        const next = new Set(prev);
                                        if (c) next.add(o); else next.delete(o);
                                        return Array.from(next);
                                      });
                                    }}
                                    className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                  />
                                  <span className={cn("text-sm transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{o}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Differentials */}
                  <div className="space-y-6">
                    <div className="space-y-3 px-1">
                      <Label className="text-sm font-semibold text-foreground">Diferenciais</Label>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-2.5">
                          {differentialOptions.map((o) => {
                            const checked = selectedDifferentials.includes(o);
                            return (
                              <label key={o} className="flex items-center gap-2 cursor-pointer group select-none">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(c) => {
                                    setSelectedDifferentials((prev) => {
                                      const next = new Set(prev);
                                      if (c) next.add(o); else next.delete(o);
                                      return Array.from(next);
                                    });
                                  }}
                                  className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                                />
                                <span className={cn("text-sm transition-colors", checked ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground")}>{o}</span>
                              </label>
                            );
                          })}
                        </div>
                        <Separator className="bg-border" />
                        <div className="space-y-2 pt-1">
                          <Label htmlFor="differentials" className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Outros (Personalizado)</Label>
                          <Textarea
                            id="differentials"
                            rows={4}
                            placeholder="Ex.: Visual marcante..."
                            value={differentials}
                            onChange={(e) => setDifferentials(e.target.value)}
                            className="resize-none text-sm bg-background border-border focus:bg-background transition-colors"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Blocos que não podem faltar</CardTitle>
              <CardDescription>Monte “Acompanha”, “Cuidados” e “Envio” para qualquer categoria.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="kit">Acompanha (lista)</Label>
                  <Textarea
                    id="kit"
                    rows={3}
                    value={kit}
                    onChange={(e) => setKit(e.target.value)}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Liste itens do kit, embalagens e brindes. Uma linha por item ou separação por ponto e vírgula.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keywords">Palavras-chave (tags/SEO)</Label>
                  <Textarea
                    id="keywords"
                    rows={3}
                    placeholder="Ex.: anel dourado; joia contemporânea; presente feminino"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Ajuda na busca interna: cores, material, estilo, ocasião, público.
                  </p>
                  <div className="mt-2">
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleCopyKeywords}>
                      <Clipboard className="h-4 w-4" />
                      Copiar tags
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="care">Cuidados (lista)</Label>
                  <Textarea
                    id="care"
                    rows={4}
                    value={care}
                    onChange={(e) => setCare(e.target.value)}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shipping">Envio (lista)</Label>
                  <Textarea
                    id="shipping"
                    rows={4}
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    className="resize-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="border-amber-200 text-amber-800">
                  {productType.label}: destaque {productType.focus}
                </Badge>
                <Badge variant="outline">Sem promessas de garantia irreais</Badge>
                <Badge variant="outline">Nada de links ou WhatsApp</Badge>
                <Badge variant="outline">Medidas em cm/mm sempre que possível</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-4">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Prévia estruturada</CardTitle>
                  <CardDescription>Copie e ajuste no anúncio do Mercado Livre.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Wand2 className="h-4 w-4" />
                    vivo
                  </Badge>
                  {(() => {
                    const count = (preview || "").length;
                    const warn = count > 2200;
                    return (
                      <Badge
                        variant={warn ? "outline" : "secondary"}
                        className={warn ? "border-red-300 text-red-700" : ""}
                      >
                        {count} caracteres
                      </Badge>
                    );
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{preview || "Preencha os campos para gerar a prévia."}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopy} className="gap-2">
                  <Clipboard className="h-4 w-4" />
                  Copiar descrição
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={() => {
                    setCare(defaultCare);
                    setShipping(defaultShipping);
                    setKit(defaultKit);
                  }}
                >
                  <PackagePlus className="h-4 w-4" />
                  Restaurar blocos padrão
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
