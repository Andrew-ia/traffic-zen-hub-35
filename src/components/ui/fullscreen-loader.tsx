import React, { useEffect, useState } from "react";
import { CheckCircle, RefreshCw, AlertCircle } from "lucide-react";

interface FullscreenLoaderProps {
  title?: string;
  subtitle?: string;
  progress?: number | null;
  stages?: string[];
  currentStage?: number;
}

export function FullscreenLoader({ 
  title = "Carregando", 
  subtitle, 
  progress,
  stages = [],
  currentStage = 0
}: FullscreenLoaderProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // Smooth progress animation
  useEffect(() => {
    if (typeof progress === "number") {
      const timer = setTimeout(() => {
        setDisplayProgress(progress);
        if (progress === 100) {
          setIsComplete(true);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [progress]);

  const progressPercentage = typeof progress === "number" ? displayProgress : 0;
  const hasProgressBar = typeof progress === "number";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      {/* Enhanced ambient gradient glow */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] rounded-full bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 blur-3xl animate-pulse" />
        <div className="absolute left-1/3 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[20rem] h-[20rem] rounded-full bg-gradient-to-tr from-green-400/20 to-blue-500/20 blur-2xl animate-pulse delay-1000" />
      </div>

      <div className="relative flex flex-col items-center gap-6 px-10 py-12 rounded-3xl border border-border/60 bg-card/90 shadow-2xl min-w-[400px] max-w-md">
        {/* Enhanced Spinner with Progress Ring */}
        <div className="relative">
          {hasProgressBar ? (
            // Progress Ring
            <div className="relative h-20 w-20">
              <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
                {/* Background circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted-foreground/20"
                />
                {/* Progress circle */}
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="text-blue-500 transition-all duration-500 ease-out"
                  style={{
                    strokeDasharray: `${2 * Math.PI * 36}`,
                    strokeDashoffset: `${2 * Math.PI * 36 * (1 - progressPercentage / 100)}`,
                  }}
                />
              </svg>
              {/* Center Icon */}
              <div className="absolute inset-0 flex items-center justify-center">
                {isComplete ? (
                  <CheckCircle className="h-8 w-8 text-green-500 animate-in zoom-in duration-300" />
                ) : (
                  <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
                )}
              </div>
            </div>
          ) : (
            // Default spinner
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <div className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-primary animate-pulse" />
            </div>
          )}
        </div>

        {/* Title and Subtitle */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              {subtitle}
            </p>
          )}
        </div>

        {/* Progress Bar and Percentage */}
        {hasProgressBar && (
          <div className="w-full space-y-3">
            {/* Percentage Display */}
            <div className="flex items-center justify-center">
              <div className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                <span className="text-lg font-bold text-blue-600">
                  {progressPercentage}%
                </span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out relative overflow-hidden"
                style={{ width: `${progressPercentage}%` }}
              >
                {/* Animated shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        {/* Stages Progress */}
        {stages.length > 0 && (
          <div className="w-full space-y-2">
            <p className="text-xs font-medium text-muted-foreground text-center mb-3">
              Etapas da Sincronização
            </p>
            <div className="space-y-2">
              {stages.map((stage, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    index < currentStage 
                      ? 'bg-green-500 border-green-500' 
                      : index === currentStage 
                      ? 'bg-blue-500 border-blue-500 animate-pulse' 
                      : 'border-muted-foreground/30'
                  }`}>
                    {index < currentStage && (
                      <CheckCircle className="h-3 w-3 text-white" />
                    )}
                    {index === currentStage && (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    )}
                  </div>
                  <span className={`text-sm transition-colors duration-300 ${
                    index <= currentStage ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}>
                    {stage}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading dots animation */}
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
              style={{
                animationDelay: `${i * 200}ms`,
                animationDuration: '1s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default FullscreenLoader;

