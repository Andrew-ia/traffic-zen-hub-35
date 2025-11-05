-- Configurar políticas de acesso ao bucket 'creatives'
-- Executar este script se houver problemas de upload

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Public read access for creatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload creatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update creatives" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete creatives" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete" ON storage.objects;

-- Política 1: Permitir leitura pública de todos os arquivos no bucket 'creatives'
CREATE POLICY "Allow public read creatives"
ON storage.objects FOR SELECT
USING (bucket_id = 'creatives');

-- Política 2: Permitir upload sem autenticação (para desenvolvimento/testes)
-- NOTA: Em produção, ajuste para auth.uid() IS NOT NULL ou regras específicas
CREATE POLICY "Allow public upload creatives"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'creatives');

-- Política 3: Permitir atualização de objetos
CREATE POLICY "Allow public update creatives"
ON storage.objects FOR UPDATE
USING (bucket_id = 'creatives')
WITH CHECK (bucket_id = 'creatives');

-- Política 4: Permitir deleção de objetos
CREATE POLICY "Allow public delete creatives"
ON storage.objects FOR DELETE
USING (bucket_id = 'creatives');

-- Verificar políticas criadas
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE '%creatives%'
ORDER BY policyname;
