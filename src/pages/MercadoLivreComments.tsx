import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
    type MercadoLivreProductReview,
    type MercadoLivreReviewItem,
    useMercadoLivreReviews,
} from "@/hooks/useMercadoLivre";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, ExternalLink, ImageIcon, Search, Star } from "lucide-react";

type FilteredReviewItem = MercadoLivreReviewItem & {
    visibleReviews: MercadoLivreProductReview[];
};

const formatDateTime = (value?: string | null) => {
    if (!value) return "Data indisponível";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Data indisponível";
    return parsed.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
};

const formatRating = (value?: number | null) => {
    if (!Number.isFinite(Number(value))) return "--";
    return Number(value).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });
};

const ReviewStars = ({ value }: { value: number }) => (
    <div className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, index) => {
            const filled = index < Math.round(value);
            return (
                <Star
                    key={index}
                    className={`h-4 w-4 ${filled ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                />
            );
        })}
    </div>
);

const ReviewCardSkeleton = () => (
    <Card>
        <CardHeader className="space-y-3">
            <div className="flex items-start gap-4">
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-3">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
        </CardContent>
    </Card>
);

export default function MercadoLivreComments() {
    const ITEMS_PER_PAGE = 5;
    const { currentWorkspace } = useWorkspace();
    const fallbackWorkspaceId = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || null;
    const workspaceId = currentWorkspace?.id || fallbackWorkspaceId;

    const [days, setDays] = useState<"30" | "90" | "365" | "all">("365");
    const [search, setSearch] = useState("");
    const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4plus" | "3minus">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

    const { data, isLoading, error } = useMercadoLivreReviews(
        workspaceId,
        days === "all" ? "all" : Number(days)
    );

    const normalizedSearch = search.trim().toLowerCase();

    const filteredItems = useMemo<FilteredReviewItem[]>(() => {
        const items = Array.isArray(data?.items) ? data.items : [];

        return items
            .map((item) => {
                const productHaystack = [item.productTitle, item.productId].join(" ").toLowerCase();
                const matchesProductSearch = normalizedSearch
                    ? productHaystack.includes(normalizedSearch)
                    : true;

                const visibleReviews = !normalizedSearch || matchesProductSearch
                    ? item.reviews
                    : item.reviews.filter((review) => {
                        const reviewHaystack = [
                            review.title || "",
                            review.content || "",
                        ].join(" ").toLowerCase();
                        return reviewHaystack.includes(normalizedSearch);
                    });

                return {
                    ...item,
                    visibleReviews,
                };
            })
            .filter((item) => {
                const rating = Number(item.ratingAverage || 0);
                const matchesRating =
                    ratingFilter === "all"
                        ? true
                        : ratingFilter === "5"
                            ? rating >= 4.95
                            : ratingFilter === "4plus"
                                ? rating >= 4
                                : rating > 0 && rating <= 3.9;

                if (!matchesRating) return false;
                if (!normalizedSearch) return item.visibleReviews.length > 0;

                const productHaystack = [item.productTitle, item.productId].join(" ").toLowerCase();
                return productHaystack.includes(normalizedSearch) || item.visibleReviews.length > 0;
            })
            .sort((a, b) => {
                const aTime = new Date(String(a.latestReviewDate || "")).getTime();
                const bTime = new Date(String(b.latestReviewDate || "")).getTime();
                if (bTime !== aTime) return bTime - aTime;
                if (b.reviewsWithComment !== a.reviewsWithComment) {
                    return b.reviewsWithComment - a.reviewsWithComment;
                }
                return b.totalReviews - a.totalReviews;
            });
    }, [data?.items, normalizedSearch, ratingFilter]);

    const stats = useMemo(() => {
        const totalProducts = filteredItems.length;
        const totalComments = filteredItems.reduce((sum, item) => sum + item.visibleReviews.length, 0);
        const weightedSum = filteredItems.reduce((sum, item) => {
            if (!Number.isFinite(Number(item.ratingAverage)) || item.totalReviews <= 0) return sum;
            return sum + (Number(item.ratingAverage) * Number(item.totalReviews));
        }, 0);
        const totalRatings = filteredItems.reduce((sum, item) => {
            if (!Number.isFinite(Number(item.ratingAverage)) || item.totalReviews <= 0) return sum;
            return sum + Number(item.totalReviews);
        }, 0);

        return {
            totalProducts,
            totalComments,
            averageRating: totalRatings > 0 ? weightedSum / totalRatings : null,
        };
    }, [filteredItems]);

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE)),
        [filteredItems.length, ITEMS_PER_PAGE]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [workspaceId, days, search, ratingFilter]);

    useEffect(() => {
        setExpandedItems({});
    }, [workspaceId, days, search, ratingFilter, currentPage]);

    useEffect(() => {
        setCurrentPage((page) => Math.min(page, totalPages));
    }, [totalPages]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [currentPage, filteredItems, ITEMS_PER_PAGE]);

    if (!workspaceId) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
                <Star className="h-16 w-16 text-muted-foreground/50" />
                <h1 className="text-2xl font-bold">Selecione um Workspace</h1>
                <p className="text-muted-foreground">
                    Para visualizar as avaliacoes dos anuncios, selecione um workspace no menu.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Star className="h-8 w-8 text-primary" />
                        Avaliacoes dos Produtos
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Reviews com estrelas, nota media, comentarios e fotos por anuncio. Perguntas publicas nao entram aqui.
                    </p>
                </div>
                <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-xs">
                    Fonte: reviews/item do Mercado Livre
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Anuncios com reviews</CardDescription>
                        <CardTitle className="text-2xl">{stats.totalProducts}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Comentarios exibidos</CardDescription>
                        <CardTitle className="text-2xl">{stats.totalComments}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Nota media</CardDescription>
                        <CardTitle className="text-2xl">
                            {stats.averageRating ? formatRating(stats.averageRating) : "--"}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg">Filtros</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por anuncio ou comentario"
                            className="pl-9"
                        />
                    </div>

                    <Select value={days} onValueChange={(value) => setDays(value as typeof days)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Periodo" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="30">Ultimos 30 dias</SelectItem>
                            <SelectItem value="90">Ultimos 90 dias</SelectItem>
                            <SelectItem value="365">Ultimos 365 dias</SelectItem>
                            <SelectItem value="all">Todo historico retornado</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={ratingFilter} onValueChange={(value) => setRatingFilter(value as typeof ratingFilter)}>
                        <SelectTrigger>
                            <SelectValue placeholder="Nota" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas as notas</SelectItem>
                            <SelectItem value="5">Somente 5 estrelas</SelectItem>
                            <SelectItem value="4plus">4 estrelas ou mais</SelectItem>
                            <SelectItem value="3minus">3.9 estrelas ou menos</SelectItem>
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {isLoading ? (
                <div className="space-y-4">
                    <ReviewCardSkeleton />
                    <ReviewCardSkeleton />
                </div>
            ) : error ? (
                <Card>
                    <CardContent className="py-10 text-center text-sm text-red-600">
                        Nao foi possivel carregar as avaliacoes do Mercado Livre.
                    </CardContent>
                </Card>
            ) : filteredItems.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                            <Star className="h-7 w-7 text-muted-foreground" />
                        </div>
                        <h2 className="mt-4 text-lg font-semibold">Nenhuma avaliacao encontrada</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Ajuste o periodo ou os filtros para localizar reviews com comentario.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {paginatedItems.map((item) => (
                        <Card key={item.productId} className="overflow-hidden">
                            {(() => {
                                const isExpanded = Boolean(expandedItems[item.productId]);
                                const reviewsToRender = isExpanded ? item.visibleReviews : [];

                                return (
                                    <>
                                        <CardHeader className="space-y-4">
                                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                                <div className="flex min-w-0 gap-4">
                                                    {item.productThumbnail ? (
                                                        <img
                                                            src={item.productThumbnail}
                                                            alt={item.productTitle}
                                                            className="h-16 w-16 rounded-2xl object-cover border bg-muted"
                                                        />
                                                    ) : (
                                                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border bg-muted">
                                                            <Star className="h-6 w-6 text-muted-foreground" />
                                                        </div>
                                                    )}

                                                    <div className="min-w-0 space-y-2">
                                                        <CardTitle className="text-lg leading-tight line-clamp-2">
                                                            {item.productTitle}
                                                        </CardTitle>
                                                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                            <span>{item.productId}</span>
                                                            <span>Ultimo comentario: {formatDateTime(item.latestReviewDate)}</span>
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <ReviewStars value={Number(item.ratingAverage || 0)} />
                                                            <Badge variant="secondary">
                                                                {formatRating(item.ratingAverage)} / 5
                                                            </Badge>
                                                            <Badge variant="outline">
                                                                {item.totalReviews} avaliacoes
                                                            </Badge>
                                                            <Badge variant="outline">
                                                                {item.reviewsWithComment} com comentario
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                {item.productPermalink ? (
                                                    <Button asChild variant="outline" size="sm" className="w-fit">
                                                        <a href={item.productPermalink} target="_blank" rel="noreferrer">
                                                            Ver anuncio
                                                            <ExternalLink className="ml-2 h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                ) : null}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-5">
                                                <div className="rounded-xl border px-3 py-2">
                                                    5 estrelas: <strong className="text-foreground">{item.ratingLevels.fiveStar}</strong>
                                                </div>
                                                <div className="rounded-xl border px-3 py-2">
                                                    4 estrelas: <strong className="text-foreground">{item.ratingLevels.fourStar}</strong>
                                                </div>
                                                <div className="rounded-xl border px-3 py-2">
                                                    3 estrelas: <strong className="text-foreground">{item.ratingLevels.threeStar}</strong>
                                                </div>
                                                <div className="rounded-xl border px-3 py-2">
                                                    2 estrelas: <strong className="text-foreground">{item.ratingLevels.twoStar}</strong>
                                                </div>
                                                <div className="rounded-xl border px-3 py-2">
                                                    1 estrela: <strong className="text-foreground">{item.ratingLevels.oneStar}</strong>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/10 px-3 py-2">
                                                <span className="text-xs text-muted-foreground">
                                                    {isExpanded
                                                        ? `Exibindo ${reviewsToRender.length} de ${item.visibleReviews.length} comentarios`
                                                        : `${item.visibleReviews.length} comentarios disponiveis`}
                                                </span>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 border-primary/30 bg-primary/5 px-2 text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 hover:text-primary"
                                                    onClick={() =>
                                                        setExpandedItems((current) => ({
                                                            ...current,
                                                            [item.productId]: !current[item.productId],
                                                        }))
                                                    }
                                                >
                                                    {isExpanded ? (
                                                        <>
                                                            <ChevronUp className="mr-1 h-3.5 w-3.5" />
                                                            Recolher
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ChevronDown className="mr-1 h-3.5 w-3.5" />
                                                            Ver comentarios
                                                        </>
                                                    )}
                                                </Button>
                                            </div>

                                            {isExpanded ? (
                                                <div className="space-y-4 border-t border-border/10 pt-4">
                                                    {reviewsToRender.map((review) => (
                                                        <div key={review.id} className="rounded-2xl border bg-muted/20 p-4">
                                                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                                                <div className="space-y-2">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <ReviewStars value={review.rate} />
                                                                        <span className="text-sm font-semibold">
                                                                            {review.title || "Comentario sem titulo"}
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground">
                                                                        Publicado em {formatDateTime(review.dateCreated)}
                                                                        {review.buyingDate ? ` • compra em ${formatDateTime(review.buyingDate)}` : ""}
                                                                    </div>
                                                                </div>

                                                                <Badge variant="secondary">{review.rate} estrelas</Badge>
                                                            </div>

                                                            {review.content ? (
                                                                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
                                                                    {review.content}
                                                                </p>
                                                            ) : null}

                                                            {review.mediaUrls.length > 0 ? (
                                                                <div className="mt-4 flex flex-wrap gap-3">
                                                                    {review.mediaUrls.map((url, index) => (
                                                                        <a
                                                                            key={`${review.id}-${index}`}
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noreferrer"
                                                                            className="group relative overflow-hidden rounded-2xl border bg-background"
                                                                        >
                                                                            <img
                                                                                src={url}
                                                                                alt={`Midia do review ${review.id}`}
                                                                                className="h-20 w-20 object-cover transition-transform duration-200 group-hover:scale-105"
                                                                            />
                                                                        </a>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                                                                    <ImageIcon className="h-4 w-4" />
                                                                    Sem fotos anexadas neste review
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </CardContent>
                                    </>
                                );
                            })()}
                        </Card>
                    ))}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between py-2">
                            <div className="text-sm text-muted-foreground">
                                Página {currentPage} de {totalPages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                    disabled={currentPage === 1}
                                >
                                    Anterior
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                    disabled={currentPage === totalPages}
                                >
                                    Próxima
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
