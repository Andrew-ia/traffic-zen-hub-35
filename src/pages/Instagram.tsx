import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Instagram, AlertTriangle } from "lucide-react";

const WORKSPACE_ID =
  (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() ||
  "00000000-0000-0000-0000-000000000010";

export default function Instagram() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Instagram className="w-8 h-8 text-purple-600" />
            Instagram
          </h1>
          <p className="text-muted-foreground mt-1">
            Página temporariamente desabilitada
          </p>
        </div>
      </div>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-yellow-600 mx-auto mb-4" />
            <p className="text-lg font-semibold text-yellow-800 mb-2">
              Página Temporariamente Desabilitada
            </p>
            <p className="text-yellow-700 mb-4">
              A página do Instagram foi removida temporariamente devido a problemas de performance.
            </p>
            <p className="text-sm text-yellow-600">
              Workspace ID: {WORKSPACE_ID}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}