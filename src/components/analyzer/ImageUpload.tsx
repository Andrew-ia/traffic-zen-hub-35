import { useState, useRef, DragEvent } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
    Upload, 
    X, 
    Image as ImageIcon, 
    Check, 
    AlertCircle,
    GripVertical,
    Plus
} from 'lucide-react';
import { useImageUpload, UploadedImage } from '@/hooks/useImageUpload';

interface ImageUploadProps {
    existingImages?: Array<{
        url: string;
        id: string;
        size?: string;
    }>;
    onImagesChange?: (pictureIds: string[]) => void;
}

export function ImageUpload({ existingImages = [], onImagesChange }: ImageUploadProps) {
    const {
        uploadedImages,
        isUploading,
        addImages,
        removeImage,
        reorderImages,
        uploadAllImages,
        clearImages,
        getUploadStats
    } = useImageUpload();

    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const stats = getUploadStats();

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            addImages(files);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            addImages(files);
        }
        // Reset input para permitir selecionar o mesmo arquivo novamente
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleUploadAll = async () => {
        await uploadAllImages();
        const uploadedPictureIds = uploadedImages
            .filter(img => img.status === 'uploaded' && img.picture_id)
            .map(img => img.picture_id!);
        onImagesChange?.(uploadedPictureIds);
    };

    const getStatusIcon = (status: UploadedImage['status']) => {
        switch (status) {
            case 'uploaded':
                return <Check className="w-4 h-4 text-green-500" />;
            case 'error':
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case 'uploading':
                return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
            default:
                return <ImageIcon className="w-4 h-4 text-gray-400" />;
        }
    };

    const getStatusColor = (status: UploadedImage['status']) => {
        switch (status) {
            case 'uploaded':
                return 'bg-green-50 border-green-200';
            case 'error':
                return 'bg-red-50 border-red-200';
            case 'uploading':
                return 'bg-blue-50 border-blue-200';
            default:
                return 'bg-gray-50 border-gray-200';
        }
    };

    const totalImages = existingImages.length + uploadedImages.length;
    const maxImages = 10;
    const canAddMore = totalImages < maxImages;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Imagens do Produto ({existingImages.length + stats.uploaded}/{maxImages})
                </CardTitle>
                <CardDescription>
                    Adicione até {maxImages} imagens de alta qualidade. Formatos: JPG, PNG. Máximo 10MB cada.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {/* Imagens Existentes */}
                {existingImages.length > 0 && (
                    <div>
                        <h4 className="font-medium mb-3 text-sm text-gray-700">
                            Imagens Atuais ({existingImages.length})
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {existingImages.map((image, index) => (
                                <div key={image.id} className="relative group">
                                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                                        <img
                                            src={image.url}
                                            alt={`Imagem ${index + 1}`}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                    <div className="absolute -top-2 -left-2">
                                        <Badge variant="secondary" className="text-xs">
                                            {index + 1}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Upload Zone */}
                {canAddMore && (
                    <div>
                        <h4 className="font-medium mb-3 text-sm text-gray-700">
                            Adicionar Novas Imagens
                        </h4>
                        <div
                            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${
                                isDragOver 
                                    ? 'border-blue-500 bg-blue-50' 
                                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                            <p className="text-lg font-medium text-gray-700 mb-2">
                                Arraste imagens aqui ou clique para selecionar
                            </p>
                            <p className="text-sm text-gray-500">
                                JPG, PNG até 10MB • Recomendado: 1200x1200px
                            </p>
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/jpg,image/png"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                    </div>
                )}

                {/* Lista de Imagens para Upload */}
                {uploadedImages.length > 0 && (
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="font-medium text-sm text-gray-700">
                                Novas Imagens ({stats.total})
                            </h4>
                            <div className="flex gap-2">
                                {stats.pending > 0 && (
                                    <Button
                                        onClick={handleUploadAll}
                                        disabled={isUploading}
                                        size="sm"
                                        className="gap-1"
                                    >
                                        <Upload className="w-3 h-3" />
                                        {isUploading ? 'Enviando...' : `Enviar ${stats.pending}`}
                                    </Button>
                                )}
                                <Button
                                    onClick={clearImages}
                                    variant="outline"
                                    size="sm"
                                    className="gap-1"
                                >
                                    <X className="w-3 h-3" />
                                    Limpar
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {uploadedImages.map((image, index) => (
                                <div
                                    key={image.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${getStatusColor(image.status)}`}
                                >
                                    <GripVertical className="w-4 h-4 text-gray-400 cursor-grab" />
                                    
                                    <div className="w-12 h-12 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                                        <img
                                            src={image.preview}
                                            alt={image.file.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {image.file.name}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {(image.file.size / 1024 / 1024).toFixed(1)} MB
                                        </p>
                                        {image.error && (
                                            <p className="text-xs text-red-600 mt-1">
                                                {image.error}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {getStatusIcon(image.status)}
                                        <Badge variant="outline" className="text-xs">
                                            {existingImages.length + index + 1}
                                        </Badge>
                                        <Button
                                            onClick={() => removeImage(image.id)}
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 hover:bg-red-100"
                                        >
                                            <X className="w-3 h-3 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Progress Summary */}
                        {(stats.uploading > 0 || stats.uploaded > 0) && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-blue-800">
                                        Progresso do Upload
                                    </span>
                                    <span className="text-xs text-blue-600">
                                        {stats.uploaded} de {stats.total} enviadas
                                    </span>
                                </div>
                                <Progress 
                                    value={(stats.uploaded / stats.total) * 100} 
                                    className="h-2"
                                />
                                {stats.errors > 0 && (
                                    <p className="text-xs text-red-600 mt-2">
                                        {stats.errors} imagem{stats.errors > 1 ? 'ns' : ''} com erro
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Limite de imagens */}
                {!canAddMore && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                            <strong>Limite atingido:</strong> Máximo de {maxImages} imagens por produto.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}