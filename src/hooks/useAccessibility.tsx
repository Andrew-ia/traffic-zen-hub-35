import { useState, useEffect, useCallback } from "react";

export interface UseAccessibilityProps {
  announceChanges?: boolean;
  preferReducedMotion?: boolean;
}

export function useAccessibility(props: UseAccessibilityProps = {}) {
  const { announceChanges = true, preferReducedMotion = false } = props;
  
  const [reducedMotion, setReducedMotion] = useState(preferReducedMotion);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const handleChange = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  const announceToScreenReader = useCallback((message: string) => {
    if (!announceChanges) return;
    
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, [announceChanges]);
  
  return {
    reducedMotion,
    announceToScreenReader,
    prefersReducedMotion: reducedMotion
  };
}

export function generateUniqueId(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatNumberForAccessibility(value: number | string): string {
  if (typeof value === 'string') return value;
  
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)} million`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} thousand`;
  }
  
  return value.toString();
}

export function createAriaLabel(base: string, additionalInfo?: Record<string, any>): string {
  let label = base;
  
  if (additionalInfo) {
    const info = Object.entries(additionalInfo)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    
    if (info) {
      label += `. ${info}`;
    }
  }
  
  return label;
}

export default useAccessibility;