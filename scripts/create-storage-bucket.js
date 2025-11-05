#!/usr/bin/env node
/**
 * Cria o bucket 'creatives' no Supabase Storage
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://bichvnuepmgvdlrclmxb.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpY2h2bnVlcG1ndmRscmNsbXhiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTk2OTAyOSwiZXhwIjoyMDc3NTQ1MDI5fQ.eJ1H61FpwZemzmGysagCa1f0d1eF43Grj4nqj-m0QZQ';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente necessárias:');
  console.error('   - VITE_SUPABASE_URL ou SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createCreativesBucket() {
  try {
    console.log('\n🪣 Criando bucket "creatives" no Supabase Storage...\n');

    // Verificar se o bucket já existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
      console.error('❌ Erro ao listar buckets:', listError.message);
      process.exit(1);
    }

    const bucketExists = buckets?.some(bucket => bucket.name === 'creatives');

    if (bucketExists) {
      console.log('✅ Bucket "creatives" já existe!');
      console.log('   Atualizando configurações...\n');

      // Atualizar configurações do bucket
      const { data: updateData, error: updateError } = await supabase.storage.updateBucket('creatives', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/quicktime',
          'video/webm',
          'application/pdf'
        ]
      });

      if (updateError) {
        console.warn('⚠️  Aviso ao atualizar bucket:', updateError.message);
        console.log('   (Isso é normal se algumas configurações não puderem ser alteradas)\n');
      } else {
        console.log('✅ Configurações do bucket atualizadas!');
      }
    } else {
      // Criar novo bucket
      const { data, error } = await supabase.storage.createBucket('creatives', {
        public: true,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'video/mp4',
          'video/quicktime',
          'video/webm',
          'application/pdf'
        ]
      });

      if (error) {
        console.error('❌ Erro ao criar bucket:', error.message);
        process.exit(1);
      }

      console.log('✅ Bucket "creatives" criado com sucesso!');
      console.log('   Configurações:');
      console.log('   - Público: Sim');
      console.log('   - Limite de tamanho: 50MB');
      console.log('   - Tipos permitidos: imagens, vídeos, PDF\n');
    }

    // Listar informações do bucket
    const { data: bucketInfo, error: infoError } = await supabase.storage.getBucket('creatives');

    if (bucketInfo) {
      console.log('📊 Informações do bucket:');
      console.log('   Nome:', bucketInfo.name);
      console.log('   ID:', bucketInfo.id);
      console.log('   Público:', bucketInfo.public ? 'Sim' : 'Não');
      console.log('   Criado em:', new Date(bucketInfo.created_at).toLocaleString('pt-BR'));
      console.log('   Atualizado em:', new Date(bucketInfo.updated_at).toLocaleString('pt-BR'));
    }

    console.log('\n✅ Processo concluído com sucesso!\n');
    console.log('📝 Próximos passos:');
    console.log('   1. Configure as políticas de acesso no Supabase Dashboard');
    console.log('   2. Teste o upload de arquivos via aplicação\n');

  } catch (error) {
    console.error('\n❌ Erro inesperado:', error.message);
    process.exit(1);
  }
}

createCreativesBucket();
