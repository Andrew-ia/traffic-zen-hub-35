import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  titleClassName?: string;
  descriptionClassName?: string;
}

export interface PageHeaderAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  titleClassName,
  descriptionClassName
}: PageHeaderProps) {
  return (
    <div className={cn(
      "flex flex-col gap-3 sm:gap-4 lg:flex-row lg:items-center lg:justify-between",
      className
    )}>
      <div className="space-y-1 min-w-0">
        <h1 className={cn(
          "text-2xl sm:text-3xl font-bold tracking-tight break-words",
          titleClassName
        )}>
          {title}
        </h1>
        {description && (
          <p className={cn(
            "text-sm sm:text-base text-muted-foreground",
            descriptionClassName
          )}>
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex gap-2 flex-col sm:flex-row flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export function createPageActions(actions: PageHeaderAction[]) {
  return actions.map((action, index) => {
    const Icon = action.icon;
    return (
      <Button
        key={index}
        variant={action.variant || "outline"}
        size="sm"
        onClick={action.onClick}
        disabled={action.disabled || action.loading}
        className="w-full sm:w-auto"
      >
        {Icon && (
          <Icon className={`h-4 w-4 mr-2 ${action.loading ? 'animate-spin' : ''}`} />
        )}
        {action.label}
      </Button>
    );
  });
}

export default PageHeader;