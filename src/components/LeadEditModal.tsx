import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lead } from "@/hooks/useLeads";

interface LeadEditModalProps {
    lead: Lead | null;
    open: boolean;
    onClose: () => void;
    onSave: (id: string, data: Partial<Lead>) => void;
}

export function LeadEditModal({ lead, open, onClose, onSave }: LeadEditModalProps) {
    const [formData, setFormData] = useState<Partial<Lead>>({});

    const handleSave = () => {
        if (lead) {
            onSave(lead.id, formData);
            onClose();
        }
    };

    if (!lead) return null;

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Lead</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome</Label>
                            <Input
                                id="name"
                                defaultValue={lead.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                defaultValue={lead.email || ''}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="whatsapp">WhatsApp</Label>
                            <Input
                                id="whatsapp"
                                defaultValue={lead.whatsapp}
                                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="company">Empresa</Label>
                            <Input
                                id="company"
                                defaultValue={lead.company}
                                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                defaultValue={lead.status}
                                onValueChange={(value) => setFormData({ ...formData, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">Novo</SelectItem>
                                    <SelectItem value="em_contato">Em Contato</SelectItem>
                                    <SelectItem value="qualificado">Qualificado</SelectItem>
                                    <SelectItem value="perdido">Perdido</SelectItem>
                                    <SelectItem value="cliente">Cliente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="origem">Origem</Label>
                            <Input
                                id="origem"
                                defaultValue={lead.origem || ''}
                                onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="campanha">Campanha</Label>
                        <Input
                            id="campanha"
                            defaultValue={lead.campanha || ''}
                            onChange={(e) => setFormData({ ...formData, campanha: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="observacoes">Observações</Label>
                        <Textarea
                            id="observacoes"
                            rows={4}
                            defaultValue={lead.observacoes || ''}
                            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSave}>
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
