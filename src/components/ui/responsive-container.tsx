import { cn } from "@/lib/utils";

export interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  spacing?: "none" | "sm" | "md" | "lg";
  as?: React.ElementType;
}

const containerSizes = {
  sm: "max-w-2xl",
  md: "max-w-4xl", 
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full"
};

const spacingVariants = {
  none: "",
  sm: "p-2 sm:p-4",
  md: "p-3 sm:p-4 lg:p-6",
  lg: "p-4 sm:p-6 lg:p-8"
};

export function ResponsiveContainer({
  children,
  className,
  size = "full",
  spacing = "md",
  as: Component = "div"
}: ResponsiveContainerProps) {
  return (
    <Component className={cn(
      "mx-auto w-full",
      containerSizes[size],
      spacingVariants[spacing],
      className
    )}>
      {children}
    </Component>
  );
}

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3, xl: 4 },
  gap = "md"
}: {
  children: React.ReactNode;
  className?: string;
  cols?: { default?: number; sm?: number; md?: number; lg?: number; xl?: number };
  gap?: "sm" | "md" | "lg" | "xl";
}) {
  const gapSizes = {
    sm: "gap-2 sm:gap-3",
    md: "gap-3 sm:gap-4 lg:gap-6",
    lg: "gap-4 sm:gap-6 lg:gap-8",
    xl: "gap-6 sm:gap-8 lg:gap-10"
  };

  const gridCols = [
    cols.default ? `grid-cols-${cols.default}` : "grid-cols-1",
    cols.sm ? `sm:grid-cols-${cols.sm}` : "sm:grid-cols-2",
    cols.md ? `md:grid-cols-${cols.md}` : "",
    cols.lg ? `lg:grid-cols-${cols.lg}` : "lg:grid-cols-3",
    cols.xl ? `xl:grid-cols-${cols.xl}` : "xl:grid-cols-4"
  ].filter(Boolean).join(" ");

  return (
    <div className={cn("grid", gridCols, gapSizes[gap], className)}>
      {children}
    </div>
  );
}

export default ResponsiveContainer;