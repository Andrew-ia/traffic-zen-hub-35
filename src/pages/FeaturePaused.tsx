import { useNavigate } from "react-router-dom";
import { PauseCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FeaturePausedProps {
  title: string;
  description?: string;
  enableHint?: string;
  backTo?: string;
}

export default function FeaturePaused({
  title,
  description,
  enableHint,
  backTo = "/",
}: FeaturePausedProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-muted-foreground" />
            Em pausa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {description ?? "Esta área foi colocada em segundo plano e não está ativa no momento."}
          </p>
          {enableHint && (
            <div className="text-xs text-muted-foreground">
              Para reativar:{" "}
              <code className="rounded bg-muted px-1 py-0.5 font-mono">
                {enableHint}
              </code>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(backTo)}>
              Voltar
            </Button>
            <Button onClick={() => navigate("/")}>Ir para o Hub</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
