import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  count?: number;
  variant?: "card" | "list" | "table" | "chart";
  className?: string;
}

export function LoadingState({ count = 3, variant = "card", className }: LoadingStateProps) {
  const renderSkeleton = () => {
    switch (variant) {
      case "list":
        return (
          <div className={cn("space-y-3", className)}>
            {Array.from({ length: count }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-muted animate-pulse rounded" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                      <div className="h-3 bg-muted animate-pulse rounded w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      
      case "table":
        return (
          <Card className={className}>
            <CardContent className="p-0">
              <div className="divide-y">
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="p-4 flex items-center space-x-4">
                    <div className="h-4 bg-muted animate-pulse rounded w-1/4" />
                    <div className="h-4 bg-muted animate-pulse rounded w-1/3" />
                    <div className="h-4 bg-muted animate-pulse rounded w-1/6 ml-auto" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      
      case "chart":
        return (
          <Card className={className}>
            <CardContent className="p-6">
              <div className="h-64 bg-muted animate-pulse rounded-lg" />
            </CardContent>
          </Card>
        );
      
      default: // card
        return (
          <div className={cn("grid gap-4", className)}>
            {Array.from({ length: count }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <div className="h-4 bg-muted animate-pulse rounded w-20" />
                    <div className="h-8 bg-muted animate-pulse rounded w-24" />
                    <div className="h-3 bg-muted animate-pulse rounded w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
    }
  };

  return renderSkeleton();
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ 
  title = "Erro ao carregar dados", 
  message = "Não foi possível carregar os dados. Tente novamente.",
  onRetry,
  className 
}: ErrorStateProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6 text-center">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-destructive">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Tentar Novamente
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "Nenhum dado encontrado",
  message = "Não há dados disponíveis no momento.",
  icon,
  action,
  className
}: EmptyStateProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6 text-center">
        <div className="space-y-4">
          {icon && (
            <div className="mx-auto w-12 h-12 text-muted-foreground">
              {icon}
            </div>
          )}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{message}</p>
          </div>
          {action && (
            <div className="mt-4">
              {action}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default LoadingState;