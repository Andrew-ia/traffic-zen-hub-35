import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export { cn } from "@/lib/utils";

// Consistent spacing utilities
export const spacing = {
  // Container spacing
  container: {
    sm: "p-2 sm:p-4",
    md: "p-3 sm:p-4 lg:p-6", 
    lg: "p-4 sm:p-6 lg:p-8",
    xl: "p-6 sm:p-8 lg:p-10"
  },
  
  // Section spacing
  section: {
    sm: "space-y-2 sm:space-y-3",
    md: "space-y-3 sm:space-y-4 lg:space-y-6",
    lg: "space-y-4 sm:space-y-6 lg:space-y-8"
  },
  
  // Gap utilities
  gap: {
    sm: "gap-2 sm:gap-3",
    md: "gap-3 sm:gap-4 lg:gap-6",
    lg: "gap-4 sm:gap-6 lg:gap-8"
  }
};

// Consistent text utilities
export const typography = {
  // Heading sizes
  heading: {
    h1: "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
    h2: "text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight",
    h3: "text-lg sm:text-xl lg:text-2xl font-medium",
    h4: "text-base sm:text-lg font-medium"
  },
  
  // Body text
  body: {
    sm: "text-xs sm:text-sm",
    base: "text-sm sm:text-base",
    lg: "text-base sm:text-lg"
  },
  
  // Text colors
  color: {
    primary: "text-foreground",
    secondary: "text-muted-foreground",
    accent: "text-primary",
    error: "text-destructive",
    success: "text-success"
  }
};

// Consistent card utilities
export const card = {
  base: "bg-card text-card-foreground rounded-lg border shadow-sm",
  hover: "hover:shadow-md hover:scale-[1.01] transition-all duration-200",
  interactive: "cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all duration-200 active:scale-[0.99]"
};

// Consistent button utilities
export const button = {
  // Button sizes
  size: {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base"
  },
  
  // Button variants
  variant: {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    ghost: "hover:bg-accent hover:text-accent-foreground"
  }
};

// Responsive utilities
export const responsive = {
  // Hide/show utilities
  hide: {
    mobile: "hidden sm:block",
    tablet: "hidden md:block",
    desktop: "hidden lg:block"
  },
  
  // Width utilities
  width: {
    full: "w-full",
    auto: "w-auto",
    screen: "w-screen",
    max: "max-w-full"
  },
  
  // Flex utilities
  flex: {
    center: "flex items-center justify-center",
    between: "flex items-center justify-between",
    start: "flex items-center justify-start",
    end: "flex items-center justify-end"
  }
};

// Animation utilities
export const animation = {
  // Transition utilities
  transition: {
    fast: "transition-all duration-150 ease-in-out",
    normal: "transition-all duration-200 ease-in-out",
    slow: "transition-all duration-300 ease-in-out"
  },
  
  // Transform utilities
  transform: {
    hover: "hover:scale-105",
    active: "active:scale-95",
    group: "group-hover:scale-105"
  },
  
  // Animation utilities
  animate: {
    spin: "animate-spin",
    pulse: "animate-pulse",
    bounce: "animate-bounce"
  }
};

// Utility function to combine classes with responsive variants
export function cnResponsive(base: string, variants: Record<string, string>): string {
  const classes = [base];
  
  Object.entries(variants).forEach(([breakpoint, className]) => {
    if (breakpoint === 'default') {
      classes.push(className);
    } else {
      classes.push(`${breakpoint}:${className}`);
    }
  });
  
  return twMerge(clsx(classes));
}

// Utility function for consistent focus states
export function focusRing(color: string = "primary"): string {
  const colors = {
    primary: "focus-visible:ring-primary",
    secondary: "focus-visible:ring-secondary",
    destructive: "focus-visible:ring-destructive",
    success: "focus-visible:ring-success"
  };
  
  return `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${colors[color] || colors.primary}`;
}

// Utility function for consistent shadow utilities
export function shadow(level: "sm" | "md" | "lg" | "xl" | "none" = "sm"): string {
  const shadows = {
    none: "shadow-none",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg",
    xl: "shadow-xl"
  };
  
  return shadows[level];
}

export default {
  spacing,
  typography,
  card,
  button,
  responsive,
  animation,
  cnResponsive,
  focusRing,
  shadow
};