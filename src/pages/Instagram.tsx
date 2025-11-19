import { Card, CardContent } from "@/components/ui/card";
import { Instagram } from "lucide-react";

export default function Instagram() {
  console.log("Instagram page rendering...");

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold flex items-center gap-2 mb-6">
        <Instagram className="w-8 h-8 text-purple-600" />
        Instagram Analytics
      </h1>
      
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <Instagram className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Instagram Dashboard</h2>
            <p className="text-muted-foreground">
              Página carregada com sucesso. Verificando funcionalidade...
            </p>
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-green-800 font-medium">✅ Página Instagram funcionando!</p>
              <p className="text-green-600 text-sm mt-1">
                Se você consegue ver esta mensagem, a página está carregando corretamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}