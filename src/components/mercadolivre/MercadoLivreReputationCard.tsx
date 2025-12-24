import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";

interface MercadoLivreReputationCardProps {
    reputationLevel: string;
    reputationColor: string;
    claimsRate: number;
    cancellationsRate: number;
    deliveryOnTimeRate?: number; // High % (e.g. 99%)
    delayedHandlingRate?: number; // Low % (e.g. 1%) - if provided, overrides onTime
    loading?: boolean;
}

export function MercadoLivreReputationCard({
    reputationLevel = "MercadoLíder",
    reputationColor = "Verde",
    claimsRate = 0,
    cancellationsRate = 0,
    deliveryOnTimeRate,
    delayedHandlingRate,
    loading
}: MercadoLivreReputationCardProps) {

    // Calculate display values
    // If delayedHandlingRate is provided (e.g. 0.9), onTime is 100 - 0.9 = 99.1
    // If deliveryOnTimeRate is provided (e.g. 99.1), use it.
    const finalOnTimeRate = deliveryOnTimeRate ?? (delayedHandlingRate !== undefined ? 100 - delayedHandlingRate : 100);
    const finalDelayedRate = delayedHandlingRate ?? (100 - finalOnTimeRate);

    if (loading) {
        return (
            <Card className="border-none shadow-md h-full min-h-[400px]">
                <CardContent className="p-6 space-y-8">
                    <div className="h-6 bg-muted animate-pulse rounded w-24" />
                    <div className="h-40 w-40 rounded-full bg-muted animate-pulse mx-auto" />
                    <div className="space-y-4">
                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                        <div className="h-4 bg-muted animate-pulse rounded w-full" />
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Determine color hex based on reputationColor
    const getColorHex = (color: string) => {
        switch (color.toLowerCase()) {
            case "verde": return "#00A650"; // Mercado Livre Green
            case "amarelo": return "#F5D415";
            case "laranja": return "#FF7733";
            case "vermelho": return "#F23D4F";
            case "cinza":
            case "gray": return "#9CA3AF"; // Gray-400
            default: return "#00A650"; // Default to green if unknown, or maybe gray?
        }
    };

    const colorHex = getColorHex(reputationColor);

    return (
        <Card className="border-border/40 bg-card/50 backdrop-blur-md shadow-lg rounded-3xl overflow-hidden group">
            <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Star className="h-5 w-5 text-[#FFD100]" />
                    Reputação
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 flex flex-col items-center">

                {/* Circular Gauge */}
                <div className="relative w-48 h-48 flex items-center justify-center mb-6">
                    {/* Background Circle */}
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="96"
                            cy="96"
                            r="80"
                            fill="transparent"
                            stroke="currentColor"
                            strokeWidth="12"
                            className="text-muted/10"
                        />
                        <circle
                            cx="96"
                            cy="96"
                            r="80"
                            fill="transparent"
                            stroke={colorHex}
                            strokeWidth="12"
                            strokeDasharray={502}
                            strokeDashoffset={0}
                            strokeLinecap="round"
                            className="drop-shadow-sm transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,0,0,0.1)]"
                        />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-3xl font-black tracking-tighter" style={{ color: colorHex }}>
                            {reputationColor}
                        </span>
                        <Badge variant="secondary" className="mt-2 bg-muted/50 text-[10px] font-bold uppercase tracking-widest border-none">
                            {reputationLevel}
                        </Badge>
                    </div>
                </div>

                <div className="w-full space-y-6">
                    {/* Reclamações */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                            <span className="text-muted-foreground">Reclamações</span>
                            <span className={claimsRate > 1 ? "text-[#F52F41]" : "text-[#00A650]"}>{claimsRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={(claimsRate / 2) * 100} className="h-1.5 bg-muted/20" indicatorClassName={claimsRate > 1 ? "bg-[#F52F41]" : "bg-[#00A650] shadow-[0_0_8px_rgba(0,166,80,0.4)]"} />
                    </div>

                    {/* Cancelamentos */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                            <span className="text-muted-foreground">Cancelamentos</span>
                            <span className={cancellationsRate > 1 ? "text-[#F52F41]" : "text-[#00A650]"}>{cancellationsRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={(cancellationsRate / 2) * 100} className="h-1.5 bg-muted/20" indicatorClassName={cancellationsRate > 1 ? "bg-[#F52F41]" : "bg-[#00A650] shadow-[0_0_8px_rgba(0,166,80,0.4)]"} />
                    </div>

                    {/* Entregas no Prazo */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-widest">
                            <span className="text-muted-foreground font-bold">Entregas no Prazo</span>
                            <span className={finalOnTimeRate < 97 ? "text-[#F52F41]" : "text-[#3483FA]"}>{finalOnTimeRate.toFixed(1)}%</span>
                        </div>
                        <Progress value={finalOnTimeRate} className="h-1.5 bg-muted/20" indicatorClassName={finalOnTimeRate < 97 ? "bg-[#F52F41]" : "bg-[#3483FA] shadow-[0_0_8px_rgba(52,131,250,0.4)]"} />
                    </div>
                </div>

            </CardContent>
        </Card>
    );
}
