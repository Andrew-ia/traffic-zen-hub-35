import { useState } from 'react';
import { useWorkspace } from './useWorkspace';

export interface UploadedImage {
    id: string;
    picture_id?: string;
    file: File;
    preview: string;
    url?: string;
    status: 'pending' | 'uploading' | 'uploaded' | 'error';
    error?: string;
    progress?: number;
}

export interface ImageUploadResult {
    success: boolean;
    picture_id?: string;
    url?: string;
    message?: string;
    error?: string;
}

export function useImageUpload() {
    const { currentWorkspace } = useWorkspace();
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    const addImages = (files: FileList | File[]) => {
        const fileArray = Array.from(files);
        const validFiles = fileArray.filter(file => {
            const isValidType = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
            const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
            return isValidType && isValidSize;
        });

        const newImages: UploadedImage[] = validFiles.map(file => ({
            id: crypto.randomUUID(),
            file,
            preview: URL.createObjectURL(file),
            status: 'pending'
        }));

        setUploadedImages(prev => [...prev, ...newImages]);
        return newImages;
    };

    const removeImage = (id: string) => {
        setUploadedImages(prev => {
            const image = prev.find(img => img.id === id);
            if (image?.preview && image.preview.startsWith('blob:')) {
                URL.revokeObjectURL(image.preview);
            }
            return prev.filter(img => img.id !== id);
        });
    };

    const reorderImages = (startIndex: number, endIndex: number) => {
        setUploadedImages(prev => {
            const result = Array.from(prev);
            const [removed] = result.splice(startIndex, 1);
            result.splice(endIndex, 0, removed);
            return result;
        });
    };

    const uploadImage = async (image: UploadedImage): Promise<ImageUploadResult> => {
        if (!currentWorkspace?.id) {
            return { success: false, error: 'Workspace não encontrado' };
        }

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const imageData = e.target?.result as string;

                    const response = await fetch('/api/integrations/mercadolivre/upload-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            workspaceId: currentWorkspace.id,
                            imageData,
                            fileName: image.file.name
                        })
                    });

                    const result = await response.json();

                    if (response.ok && result.success) {
                        setUploadedImages(prev => 
                            prev.map(img => 
                                img.id === image.id 
                                    ? { 
                                        ...img, 
                                        status: 'uploaded',
                                        picture_id: result.picture_id,
                                        url: result.url
                                    }
                                    : img
                            )
                        );
                        resolve({ 
                            success: true, 
                            picture_id: result.picture_id,
                            url: result.url,
                            message: result.message 
                        });
                    } else {
                        setUploadedImages(prev => 
                            prev.map(img => 
                                img.id === image.id 
                                    ? { ...img, status: 'error', error: result.error }
                                    : img
                            )
                        );
                        resolve({ success: false, error: result.error });
                    }
                } catch (error) {
                    setUploadedImages(prev => 
                        prev.map(img => 
                            img.id === image.id 
                                ? { ...img, status: 'error', error: 'Erro no upload' }
                                : img
                        )
                    );
                    resolve({ success: false, error: 'Erro no upload' });
                }
            };

            reader.onerror = () => {
                resolve({ success: false, error: 'Erro ao ler arquivo' });
            };

            reader.readAsDataURL(image.file);
        });
    };

    const uploadAllImages = async () => {
        setIsUploading(true);
        const pendingImages = uploadedImages.filter(img => img.status === 'pending');
        
        try {
            for (const image of pendingImages) {
                setUploadedImages(prev => 
                    prev.map(img => 
                        img.id === image.id 
                            ? { ...img, status: 'uploading' }
                            : img
                    )
                );
                
                await uploadImage(image);
            }
        } finally {
            setIsUploading(false);
        }
    };

    const addPicturesToProduct = async (mlbId: string) => {
        if (!currentWorkspace?.id) {
            throw new Error('Workspace não encontrado');
        }

        const uploadedPictureIds = uploadedImages
            .filter(img => img.status === 'uploaded' && img.picture_id)
            .map(img => img.picture_id!);

        if (uploadedPictureIds.length === 0) {
            throw new Error('Nenhuma imagem foi enviada');
        }

        const response = await fetch('/api/integrations/mercadolivre/add-pictures', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                mlbId,
                workspaceId: currentWorkspace.id,
                pictureIds: uploadedPictureIds
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro ao adicionar imagens');
        }

        return result;
    };

    const clearImages = () => {
        uploadedImages.forEach(image => {
            if (image.preview && image.preview.startsWith('blob:')) {
                URL.revokeObjectURL(image.preview);
            }
        });
        setUploadedImages([]);
    };

    const getUploadStats = () => {
        const total = uploadedImages.length;
        const uploaded = uploadedImages.filter(img => img.status === 'uploaded').length;
        const pending = uploadedImages.filter(img => img.status === 'pending').length;
        const uploading = uploadedImages.filter(img => img.status === 'uploading').length;
        const errors = uploadedImages.filter(img => img.status === 'error').length;

        return { total, uploaded, pending, uploading, errors };
    };

    return {
        uploadedImages,
        isUploading,
        addImages,
        removeImage,
        reorderImages,
        uploadAllImages,
        addPicturesToProduct,
        clearImages,
        getUploadStats
    };
}