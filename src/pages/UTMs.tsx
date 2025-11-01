import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Link2, Save, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

const templates = [
  { id: 1, name: "Facebook Ads", pattern: "utm_source=facebook&utm_medium=paid&utm_campaign={{campaign}}" },
  { id: 2, name: "Google Ads", pattern: "utm_source=google&utm_medium=cpc&utm_campaign={{campaign}}" },
  { id: 3, name: "Instagram", pattern: "utm_source=instagram&utm_medium=social&utm_campaign={{campaign}}" },
];

export default function UTMs() {
  const [baseUrl, setBaseUrl] = useState("https://seusite.com.br");
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [term, setTerm] = useState("");

  const generateUrl = () => {
    const params = new URLSearchParams();
    if (source) params.append("utm_source", source);
    if (medium) params.append("utm_medium", medium);
    if (campaign) params.append("utm_campaign", campaign);
    if (content) params.append("utm_content", content);
    if (term) params.append("utm_term", term);
    
    return `${baseUrl}?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerador de UTMs</h1>
          <p className="text-muted-foreground mt-1">
            Crie e padronize UTMs para rastreamento de campanhas
          </p>
        </div>
        <Button>
          <Save className="mr-2 h-4 w-4" />
          Salvar Template
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Criar Nova UTM</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl">URL Base *</Label>
                <Input
                  id="baseUrl"
                  placeholder="https://seusite.com.br"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="source">Origem (Source) *</Label>
                  <Input
                    id="source"
                    placeholder="facebook, google, newsletter"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medium">Mídia (Medium) *</Label>
                  <Select value={medium} onValueChange={setMedium}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpc">CPC</SelectItem>
                      <SelectItem value="paid">Paid Social</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="social">Social</SelectItem>
                      <SelectItem value="organic">Organic</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign">Campanha (Campaign) *</Label>
                <Input
                  id="campaign"
                  placeholder="black_friday_2025"
                  value={campaign}
                  onChange={(e) => setCampaign(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="content">Conteúdo (Content)</Label>
                  <Input
                    id="content"
                    placeholder="banner_hero, cta_bottom"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="term">Termo (Term)</Label>
                  <Input
                    id="term"
                    placeholder="palavra-chave"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>URL Gerada</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-lg bg-muted font-mono text-sm break-all">
                  {generateUrl()}
                </div>
                <Button size="icon" variant="outline">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" className="flex-1">
                  <Link2 className="mr-2 h-4 w-4" />
                  Encurtar URL
                </Button>
                <Button variant="outline" className="flex-1">
                  <FileText className="mr-2 h-4 w-4" />
                  Testar no GA4
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Templates Salvos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="p-3 rounded-lg border cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{template.name}</p>
                    <Button variant="ghost" size="sm">Usar</Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {template.pattern}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Convenções</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Formato recomendado:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Use snake_case</li>
                  <li>• Letras minúsculas</li>
                  <li>• Sem espaços ou acentos</li>
                  <li>• Seja consistente</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Exemplos:</p>
                <div className="space-y-1">
                  <Badge variant="outline" className="font-mono">facebook_ads</Badge>
                  <Badge variant="outline" className="font-mono">black_friday_2025</Badge>
                  <Badge variant="outline" className="font-mono">banner_topo</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
