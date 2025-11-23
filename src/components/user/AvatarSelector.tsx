import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { User } from "lucide-react";

const AVATAR_STYLES = [
    { id: "avataaars", name: "Avataaars" },
    { id: "bottts", name: "Robôs" },
    { id: "personas", name: "Personas" },
    { id: "lorelei", name: "Lorelei" },
    { id: "micah", name: "Micah" },
    { id: "fun-emoji", name: "Emoji" },
];

const AVATAR_SEEDS = [
    "Felix", "Aneka", "Garland", "Jasmine", "Milo", "Luna",
    "Oliver", "Sophie", "Max", "Bella", "Charlie", "Daisy",
    "Jack", "Lucy", "Oscar", "Molly", "Toby", "Sadie",
    "Bailey", "Chloe", "Rocky", "Lily", "Buddy", "Zoe",
];

export function AvatarSelector() {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [selectedStyle, setSelectedStyle] = useState("avataaars");
    const [selectedSeed, setSelectedSeed] = useState("Felix");
    const [currentAvatar, setCurrentAvatar] = useState({ style: "avataaars", seed: "Felix" });

    useEffect(() => {
        if (!user?.id) return;
        (async () => {
            try {
                const response = await fetch(`/api/user-preferences/${user.id}`);
                const result = await response.json();
                if (result.success && result.data) {
                    setCurrentAvatar({ style: result.data.avatar_style || "avataaars", seed: result.data.avatar_seed || "Felix" });
                    setSelectedStyle(result.data.avatar_style || "avataaars");
                    setSelectedSeed(result.data.avatar_seed || "Felix");
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
            }
        })();
    }, [user?.id]);

    const saveAvatar = async () => {
        if (!user?.id) return;

        try {
            const response = await fetch(`/api/user-preferences/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    avatar_style: selectedStyle,
                    avatar_seed: selectedSeed,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setCurrentAvatar({ style: selectedStyle, seed: selectedSeed });
                setOpen(false);
            }
        } catch (error) {
            console.error('Error saving avatar:', error);
        }
    };

    const getAvatarUrl = (style: string, seed: string) => {
        return `https://api.dicebear.com/7.x/${style}/svg?seed=${seed}`;
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={getAvatarUrl(currentAvatar.style, currentAvatar.seed)} />
                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Escolher Avatar</DialogTitle>
                    <DialogDescription>
                        Selecione um estilo e um avatar para personalizar seu perfil
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Style Selection */}
                    <div>
                        <h3 className="text-sm font-medium mb-3">Estilo</h3>
                        <div className="grid grid-cols-3 gap-2">
                            {AVATAR_STYLES.map((style) => (
                                <Button
                                    key={style.id}
                                    variant={selectedStyle === style.id ? "default" : "outline"}
                                    onClick={() => setSelectedStyle(style.id)}
                                    className="w-full"
                                >
                                    {style.name}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Avatar Selection */}
                    <div>
                        <h3 className="text-sm font-medium mb-3">Avatar</h3>
                        <div className="grid grid-cols-6 gap-3">
                            {AVATAR_SEEDS.map((seed) => (
                                <button
                                    key={seed}
                                    onClick={() => setSelectedSeed(seed)}
                                    className={`p-2 rounded-lg border-2 transition-all hover:scale-105 ${selectedSeed === seed
                                        ? "border-primary bg-primary/10"
                                        : "border-border hover:border-primary/50"
                                        }`}
                                >
                                    <Avatar className="h-12 w-12">
                                        <AvatarImage src={getAvatarUrl(selectedStyle, seed)} />
                                    </Avatar>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={getAvatarUrl(selectedStyle, selectedSeed)} />
                        </Avatar>
                        <div>
                            <p className="font-medium">Pré-visualização</p>
                            <p className="text-sm text-muted-foreground">
                                {AVATAR_STYLES.find(s => s.id === selectedStyle)?.name} - {selectedSeed}
                            </p>
                        </div>
                    </div>

                    <Button onClick={saveAvatar} className="w-full">
                        Salvar Avatar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
