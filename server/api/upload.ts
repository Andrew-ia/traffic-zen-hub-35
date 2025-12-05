import { Router } from "express";
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

console.log('📂 Upload module loaded');

const router = Router();

// Rota de teste
router.get('/', (req, res) => {
    console.log('🧪 Upload test endpoint called');
    res.json({ message: 'Upload API is working!' });
});

// Configurar Supabase
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configurar multer para upload de arquivos
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.'));
        }
    }
});

/**
 * POST /api/upload/image
 * Upload de imagem para Supabase Storage
 */
router.post('/image', upload.single('image'), async (req, res) => {
    console.log('📤 Upload image endpoint called');
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Nenhuma imagem foi enviada' });
        }

        const { workspaceId } = req.body;
        if (!workspaceId) {
            return res.status(400).json({ error: 'workspaceId é obrigatório' });
        }

        // Gerar nome único para o arquivo
        const fileExtension = path.extname(req.file.originalname);
        const fileName = `${uuidv4()}${fileExtension}`;
        const filePath = `products/${workspaceId}/${fileName}`;

        console.log(`📤 Uploading image: ${filePath}`);

        // Upload para Supabase Storage
        const { data, error } = await supabase.storage
            .from('product-images')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ Supabase upload error:', error);
            return res.status(500).json({ 
                error: 'Erro ao fazer upload da imagem', 
                details: error.message 
            });
        }

        // Gerar URL pública
        const { data: urlData } = supabase.storage
            .from('product-images')
            .getPublicUrl(filePath);

        const imageUrl = urlData.publicUrl;

        console.log(`✅ Image uploaded successfully: ${imageUrl}`);

        return res.json({
            success: true,
            url: imageUrl,
            fileName: fileName,
            originalName: req.file.originalname,
            size: req.file.size
        });

    } catch (error: any) {
        console.error('❌ Upload error:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor', 
            details: error.message 
        });
    }
});

/**
 * DELETE /api/upload/image
 * Deletar imagem do Supabase Storage
 */
router.delete('/image', async (req, res) => {
    try {
        const { imageUrl, workspaceId } = req.body;

        if (!imageUrl || !workspaceId) {
            return res.status(400).json({ 
                error: 'imageUrl e workspaceId são obrigatórios' 
            });
        }

        // Extrair o path da URL
        const urlParts = imageUrl.split('/product-images/');
        if (urlParts.length !== 2) {
            return res.status(400).json({ error: 'URL de imagem inválida' });
        }

        const filePath = urlParts[1];

        // Verificar se o arquivo pertence ao workspace
        if (!filePath.startsWith(`products/${workspaceId}/`)) {
            return res.status(403).json({ 
                error: 'Você não tem permissão para deletar esta imagem' 
            });
        }

        console.log(`🗑️ Deleting image: ${filePath}`);

        // Deletar do Supabase Storage
        const { error } = await supabase.storage
            .from('product-images')
            .remove([filePath]);

        if (error) {
            console.error('❌ Supabase delete error:', error);
            return res.status(500).json({ 
                error: 'Erro ao deletar imagem', 
                details: error.message 
            });
        }

        console.log(`✅ Image deleted successfully: ${filePath}`);

        return res.json({ success: true, message: 'Imagem deletada com sucesso' });

    } catch (error: any) {
        console.error('❌ Delete error:', error);
        return res.status(500).json({ 
            error: 'Erro interno do servidor', 
            details: error.message 
        });
    }
});

export default router;