import React, { useState } from 'react';
import { Search, Loader2, ArrowRight, ExternalLink } from 'lucide-react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from '../../utils/formatters';

interface SearchResult {
    id: string;
    title: string;
    price: number;
    original_price?: number;
    thumbnail: string;
    permalink: string;
    seller: {
        id: number;
        nickname: string;
    };
    installments?: {
        quantity: number;
        amount: number;
    };
}

interface CompetitorSearchProps {
    onAnalyze: (mlbId: string) => void | Promise<any>;
    isAnalyzing?: boolean;
    workspaceId?: string;
}

export function CompetitorSearch({ onAnalyze, isAnalyzing, workspaceId }: CompetitorSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);
        try {
            // Client-side fetch to avoid server-side 403 blocks (IP reputation)
            // Mercado Livre Search API supports CORS for public queries
            const response = await fetch(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=20`);

            if (!response.ok) {
                throw new Error('Falha na busca');
            }

            const data = await response.json();
            setResults(data.results || []);
        } catch (error) {
            console.error('Search failed:', error);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border shadow-sm">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar produtos (ex: Fone Bluetooth, Garrafa Térmica...)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-10 h-12 text-lg"
                        />
                    </div>
                    <Button type="submit" size="lg" disabled={loading} className="h-12 px-8">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Buscar'}
                    </Button>
                </form>
            </div>

            {searched && results.length === 0 && !loading && (
                <div className="text-center py-12 text-muted-foreground">
                    Nenhum produto encontrado para "{query}"
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {results.map((item) => (
                    <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                        <CardContent className="p-4 flex flex-col h-full">
                            <div className="aspect-square relative mb-4 bg-gray-50 rounded-lg overflow-hidden">
                                <img
                                    src={item.thumbnail.replace('I.jpg', 'O.jpg')}
                                    alt={item.title}
                                    className="object-contain w-full h-full mix-blend-multiply"
                                />
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => window.open(item.permalink, '_blank')}
                                    title="Ver no Mercado Livre"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2 flex-1 flex flex-col">
                                <div className="text-xs text-muted-foreground">
                                    MLB: {item.id}
                                </div>
                                <h3 className="font-medium text-sm line-clamp-2 leading-tight flex-1" title={item.title}>
                                    {item.title}
                                </h3>

                                <div className="mt-2">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-primary">
                                            {formatCurrency(item.price)}
                                        </span>
                                        {item.original_price && item.original_price > item.price && (
                                            <span className="text-xs text-muted-foreground line-through">
                                                {formatCurrency(item.original_price)}
                                            </span>
                                        )}
                                    </div>
                                    {item.installments && (
                                        <div className="text-xs text-green-600 font-medium">
                                            {item.installments.quantity}x de {formatCurrency(item.installments.amount)}
                                        </div>
                                    )}
                                </div>

                                <Button
                                    className="w-full mt-4 gap-2"
                                    onClick={() => onAnalyze(item.id)}
                                    disabled={isAnalyzing}
                                    variant="outline"
                                >
                                    {isAnalyzing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            Analisar Anúncio
                                            <ArrowRight className="h-4 w-4" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
