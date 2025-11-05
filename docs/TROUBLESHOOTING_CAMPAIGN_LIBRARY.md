# Troubleshooting - Biblioteca de Campanhas

## Problema: Campanhas não aparecem na lista

### Verificações Rápidas

1. **Abra o Console do Navegador** (F12 ou Ctrl+Shift+I)
   - Vá para a aba "Console"
   - Procure por mensagens com emojis: 🔄, 📡, 📥, ✅, ❌

2. **Verifique os Logs**
   - Você deve ver: `🔄 Buscando campanhas...`
   - Depois: `📡 Fazendo request para: http://localhost:3001/api/campaigns/library/...`
   - E finalmente: `✅ Campanhas carregadas: X`

3. **Verifique os Filtros**
   - Certifique-se de que todos os filtros estejam em "Todos"
   - Limpe a caixa de busca
   - Os filtros devem mostrar `undefined` no log, não valores específicos

### Solução 1: Limpar Filtros

Se você vir nos logs algo como:
```
filters: { statusFilter: "ativo", objectiveFilter: "Mensagens" }
```

Faça:
1. Clique em cada filtro (Status, Objetivo, Plataforma)
2. Selecione "Todos" em cada um
3. Limpe a caixa de busca

### Solução 2: Verificar API

Abra uma nova aba e acesse:
```
http://localhost:3001/api/campaigns/library/00000000-0000-0000-0000-000000000000
```

Você deve ver um JSON com suas campanhas:
```json
{
  "success": true,
  "campaigns": [...],
  "total": 1
}
```

Se não funcionar:
- Verifique se o servidor está rodando
- Rode: `npm run server` em um terminal separado

### Solução 3: Recarregar a Página

1. Pressione `Ctrl+Shift+R` (ou `Cmd+Shift+R` no Mac) para fazer hard refresh
2. Isso vai limpar o cache e recarregar completamente

### Solução 4: Verificar Workspace ID

O Workspace ID padrão é: `00000000-0000-0000-0000-000000000000`

Se suas campanhas foram criadas com outro workspace_id, você precisa:

1. Verificar no banco qual workspace_id foi usado:
```sql
SELECT workspace_id, name FROM campaign_library;
```

2. Atualizar o DEFAULT_WORKSPACE_ID em [src/pages/CampaignLibrary.tsx](../src/pages/CampaignLibrary.tsx#L45)

## Problema: Erro ao fazer upload de imagem

### Logs a Verificar

No console, procure por:
- `📤 Iniciando upload:`
- `📁 Upload para:`
- `❌ Erro no upload:`

### Erro: "new row violates row-level security policy"

**Causa**: As políticas de RLS (Row Level Security) estão bloqueando o upload.

**Solução**:
```bash
node scripts/run-sql.js scripts/setup-storage-policies.sql
```

### Erro: "Bucket not found"

**Causa**: O bucket 'creatives' não existe.

**Solução**:
```bash
node scripts/create-storage-bucket.js
```

### Erro: "File too large"

**Causa**: O arquivo excede 50MB.

**Solução**:
- Reduza o tamanho do arquivo
- Ou aumente o limite no bucket (via Supabase Dashboard)

### Erro: "Invalid mime type"

**Causa**: Tipo de arquivo não permitido.

**Solução**:
- Use apenas: JPG, PNG, GIF, WebP, MP4, WebM
- Ou adicione o tipo em `scripts/setup-storage-policies.sql`

## Problema: Campanha criada mas não aparece

### Verificação 1: Confirmar no Banco

```sql
SELECT id, name, status, workspace_id FROM campaign_library ORDER BY created_at DESC LIMIT 5;
```

### Verificação 2: Workspace ID Correto

Se a campanha aparece no banco mas não no frontend:
- Verifique se o `workspace_id` da campanha corresponde ao `DEFAULT_WORKSPACE_ID`
- Atualize se necessário:
```sql
UPDATE campaign_library
SET workspace_id = '00000000-0000-0000-0000-000000000000'
WHERE id = 'SEU_ID_AQUI';
```

### Verificação 3: Forçar Reload

No componente, após criar a campanha, force um reload:
1. Feche o modal
2. Recarregue a página (F5)

## Problema: CORS Error

### Erro no Console:
```
Access to fetch at 'http://localhost:3001/...' has been blocked by CORS policy
```

**Solução**:

1. Verifique se o servidor está rodando em `http://localhost:3001`
2. Verifique a configuração CORS em [server/index.ts](../server/index.ts#L31-38)
3. Certifique-se de que a URL do frontend está na lista `origin`

## Problema: Loading infinito

### Causa Provável

O `useEffect` está em loop devido a dependências.

### Verificação

No console, se você ver repetidas vezes:
```
🔄 Buscando campanhas...
🔄 Buscando campanhas...
🔄 Buscando campanhas...
```

**Solução Temporária**:
Recarregue a página.

**Solução Permanente**:
Verifique se os filtros estão sendo alterados constantemente.

## Comandos Úteis

### Reiniciar Servidor
```bash
pkill -f "node.*server"
npm run server
```

### Verificar Logs do Servidor
```bash
# Em um terminal separado, veja os logs em tempo real
tail -f logs/server.log  # se houver arquivo de log
```

### Recriar Bucket
```bash
# Se o bucket estiver com problemas
node scripts/create-storage-bucket.js
node scripts/run-sql.js scripts/setup-storage-policies.sql
```

### Limpar Cache do Navegador
1. F12 → Application → Storage
2. Clear site data
3. Recarregue a página

## Verificação Completa Passo a Passo

Execute estes passos na ordem:

1. ✅ Servidor rodando
```bash
lsof -ti:3001
# Deve retornar um número (process ID)
```

2. ✅ API respondendo
```bash
curl http://localhost:3001/health
# Deve retornar: {"status":"ok","timestamp":"..."}
```

3. ✅ Tabela existe
```bash
node scripts/run-sql.js scripts/create-campaign-library.sql
```

4. ✅ Bucket existe
```bash
node scripts/create-storage-bucket.js
```

5. ✅ Políticas configuradas
```bash
node scripts/run-sql.js scripts/setup-storage-policies.sql
```

6. ✅ Campanhas no banco
```bash
# Conecte ao banco e rode:
SELECT COUNT(*) FROM campaign_library;
```

7. ✅ Frontend buildando
```bash
npm run build
# Deve compilar sem erros
```

8. ✅ Console sem erros
- Abra F12
- Verifique aba "Console"
- Não deve ter erros em vermelho

## Ainda com Problemas?

1. **Copie os logs do console** (tudo que aparece com os emojis)
2. **Tire um screenshot** da tela
3. **Copie o erro** se houver algum
4. **Verifique** se há alguma mensagem de erro no terminal do servidor

## Exemplo de Logs Normais

Quando tudo está funcionando, você deve ver:

```
🔄 Buscando campanhas... {workspaceId: "00000000-0000-0000-0000-000000000000", filters: {…}}
📡 Fazendo request para: http://localhost:3001/api/campaigns/library/00000000-0000-0000-0000-000000000000
📥 Resposta recebida: {success: true, total: 1, campaigns: 1}
✅ Campanhas carregadas: 1
🎯 CampaignLibrary State: {campaignsCount: 1, loading: false, error: null, filters: {…}}
```

Se você ver isso, significa que está tudo OK e a campanha deve aparecer na tela!
