const { createClient } = require('@supabase/supabase-js');

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });

async function setupStorage() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não encontrados no .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    try {
        console.log('🔧 Configurando Supabase Storage...');
        
        // Verificar se o bucket existe
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('❌ Erro ao listar buckets:', listError);
            return;
        }
        
        console.log('📦 Buckets existentes:', buckets.map(b => b.name));
        
        const bucketName = 'product-images';
        const bucketExists = buckets.some(bucket => bucket.name === bucketName);
        
        if (!bucketExists) {
            console.log(`📦 Criando bucket "${bucketName}"...`);
            
            const { data, error } = await supabase.storage.createBucket(bucketName, {
                public: true,
                allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'],
                fileSizeLimit: 5242880 // 5MB
            });
            
            if (error) {
                console.error('❌ Erro ao criar bucket:', error);
                return;
            }
            
            console.log('✅ Bucket criado com sucesso!');
        } else {
            console.log('✅ Bucket já existe');
        }
        
        // Testar upload de uma imagem teste
        console.log('🧪 Testando upload...');
        
        const testImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(bucketName)
            .upload('test/test.png', testImageBuffer, {
                contentType: 'image/png',
                cacheControl: '3600',
                upsert: true
            });
            
        if (uploadError) {
            console.error('❌ Erro no teste de upload:', uploadError);
            return;
        }
        
        console.log('✅ Teste de upload bem-sucedido!');
        
        // Gerar URL pública
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl('test/test.png');
            
        console.log('🌐 URL pública teste:', urlData.publicUrl);
        
        // Limpar arquivo de teste
        await supabase.storage.from(bucketName).remove(['test/test.png']);
        console.log('🗑️ Arquivo de teste removido');
        
        console.log('\n🎉 Supabase Storage configurado com sucesso!');
        console.log('📋 Resumo:');
        console.log(`   • Bucket: ${bucketName}`);
        console.log('   • Público: Sim');
        console.log('   • Tipos permitidos: JPEG, PNG, WebP, GIF');
        console.log('   • Tamanho máximo: 5MB');
        
    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

setupStorage();