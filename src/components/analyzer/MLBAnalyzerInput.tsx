import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MLBAnalyzerInputProps {
    onAnalyze: (mlbId: string) => void;
    isLoading?: boolean;
    error?: string | null;
    lastAnalyzed?: {
        mlbId: string;
        title: string;
        score: number;
        timestamp: string;
    } | null;
    initialMlbId?: string;
}

export function MLBAnalyzerInput({ 
    onAnalyze, 
    isLoading = false, 
    error = null, 
    lastAnalyzed = null,
    initialMlbId
}: MLBAnalyzerInputProps) {
    const [mlbInput, setMlbInput] = useState(initialMlbId || "");
    const [validationError, setValidationError] = useState<string | null>(null);

    const validateMLBId = (input: string): string | null => {
        // Remove espaços e caracteres especiais
        const cleaned = input.trim().toUpperCase();
        
        // Verificar se está vazio
        if (!cleaned) {
            return "Digite um MLB ID";
        }
        
        // Verificar formato básico
        if (!cleaned.match(/^MLB\d+$/)) {
            // Se não começar com MLB, tentar adicionar
            if (cleaned.match(/^\d+$/)) {
                return null; // Apenas números, vamos adicionar MLB automaticamente
            }
            return "Formato inválido. Use: MLB1234567890 ou apenas 1234567890";
        }
        
        // Verificar comprimento do ID numérico
        const numericPart = cleaned.replace('MLB', '');
        if (numericPart.length < 8) {
            return "MLB ID muito curto. Verifique se está correto.";
        }
        
        return null;
    };

    const formatMLBId = (input: string): string => {
        const cleaned = input.trim().toUpperCase();
        
        // Se for apenas números, adicionar MLB
        if (cleaned.match(/^\d+$/)) {
            return `MLB${cleaned}`;
        }
        
        return cleaned;
    };

    const handleInputChange = (value: string) => {
        setMlbInput(value);
        setValidationError(null);
        
        if (value.trim()) {
            const error = validateMLBId(value);
            setValidationError(error);
        }
    };

    useEffect(() => {
        if (initialMlbId) {
            setMlbInput(initialMlbId);
            setValidationError(validateMLBId(initialMlbId));
        }
    }, [initialMlbId]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        const error = validateMLBId(mlbInput);
        if (error) {
            setValidationError(error);
            return;
        }
        
        const formattedMLB = formatMLBId(mlbInput);
        onAnalyze(formattedMLB);
    };

    const handlePasteExample = (exampleId: string) => {
        setMlbInput(exampleId);
        setValidationError(null);
    };

    const examples = [
        { id: "MLB5528244534", title: "Brinco Dourado" },
        { id: "MLB4129418585", title: "Carteira Feminina" },
        { id: "MLB5547317900", title: "Colar Medalha" }
    ];

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-600" />
                    Analisador de Produtos MLB
                </CardTitle>
                <CardDescription>
                    Cole o MLB ID do produto do Mercado Livre para análise completa de SEO e otimização
                </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
                {/* Input Form */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <Input
                                type="text"
                                placeholder="Ex: MLB1234567890 ou apenas 1234567890"
                                value={mlbInput}
                                onChange={(e) => handleInputChange(e.target.value)}
                                className={`${validationError ? 'border-red-500' : ''}`}
                                disabled={isLoading}
                            />
                            {validationError && (
                                <p className="text-sm text-red-600 mt-1">
                                    {validationError}
                                </p>
                            )}
                        </div>
                        
                        <Button 
                            type="submit" 
                            disabled={isLoading || !!validationError || !mlbInput.trim()}
                            className="gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Search className="h-4 w-4" />
                            )}
                            {isLoading ? 'Analisando...' : 'Analisar'}
                        </Button>
                    </div>
                </form>

                {/* Error Display */}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {error}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Last Analysis Display */}
                {lastAnalyzed && !isLoading && (
                    <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>
                            <div className="flex items-center justify-between">
                                <div>
                                    <strong>{lastAnalyzed.title}</strong> analisado
                                    <br />
                                    <span className="text-sm text-muted-foreground">
                                        Score: {lastAnalyzed.score}/100 • {lastAnalyzed.mlbId}
                                    </span>
                                </div>
                                <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => onAnalyze(lastAnalyzed.mlbId)}
                                >
                                    Re-analisar
                                </Button>
                            </div>
                        </AlertDescription>
                    </Alert>
                )}

                {/* Examples */}
                <div>
                    <p className="text-sm font-medium mb-2">Exemplos para testar:</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        {examples.map((example) => (
                            <Button
                                key={example.id}
                                variant="outline"
                                size="sm"
                                onClick={() => handlePasteExample(example.id)}
                                disabled={isLoading}
                                className="justify-start text-left"
                            >
                                <div>
                                    <div className="font-mono text-xs">{example.id}</div>
                                    <div className="text-xs text-muted-foreground">{example.title}</div>
                                </div>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Instructions */}
                <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Como encontrar o MLB ID:</h4>
                    <ul className="text-xs space-y-1 text-muted-foreground">
                        <li>• Acesse qualquer produto no Mercado Livre</li>
                        <li>• Copie o código que aparece na URL (ex: MLB1234567890)</li>
                        <li>• Ou copie apenas os números após MLB</li>
                        <li>• Cole aqui para análise completa</li>
                    </ul>
                </div>

                {/* Features Preview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                    <div className="text-center">
                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-green-600 text-sm">📊</span>
                        </div>
                        <p className="text-xs font-medium">Score 0-100</p>
                    </div>
                    
                    <div className="text-center">
                        <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-blue-600 text-sm">🎯</span>
                        </div>
                        <p className="text-xs font-medium">SEO Títulos</p>
                    </div>
                    
                    <div className="text-center">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-purple-600 text-sm">🔍</span>
                        </div>
                        <p className="text-xs font-medium">Keywords</p>
                    </div>
                    
                    <div className="text-center">
                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-1">
                            <span className="text-orange-600 text-sm">⚡</span>
                        </div>
                        <p className="text-xs font-medium">Otimização</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
