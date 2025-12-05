import { Badge } from "@/components/ui/badge";

const statusConfig = {
    new: { label: 'Novo', variant: 'default' as const, color: 'bg-blue-500' },
    em_contato: { label: 'Em Contato', variant: 'secondary' as const, color: 'bg-yellow-500' },
    qualificado: { label: 'Qualificado', variant: 'default' as const, color: 'bg-green-500' },
    perdido: { label: 'Perdido', variant: 'destructive' as const, color: 'bg-red-500' },
    cliente: { label: 'Cliente', variant: 'default' as const, color: 'bg-purple-500' },
};

interface LeadStatusBadgeProps {
    status: string;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;

    return (
        <Badge variant={config.variant} className={config.color}>
            {config.label}
        </Badge>
    );
}
