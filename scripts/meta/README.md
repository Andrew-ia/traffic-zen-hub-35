# Scripts de Sincronização do Meta Ads

## 📋 Scripts Disponíveis

### 1. `sync-campaigns.js` - Sincronização Completa
Sincroniza TODAS as campanhas, ad sets, ads e públicos do Meta.

```bash
npm run sync:meta
# ou
node scripts/meta/sync-campaigns.js
```

**Quando usar:**
- ✅ Primeira sincronização
- ✅ 1x por mês (manutenção)
- ✅ Quando houver dados inconsistentes

**Tempo:** ~10-15 minutos

---

### 2. `sync-incremental.ts` - Sincronização Incremental ⭐ NOVO
Sincroniza apenas dados dos últimos N dias (configurável).

```bash
# Últimos 7 dias (recomendado)
npm run sync:meta:incremental -- --days=7

# Último dia (rápido)
npx tsx scripts/meta/sync-incremental.ts --days=1

# Últimos 30 dias
npx tsx scripts/meta/sync-incremental.ts --days=30

# Apenas campanhas
npx tsx scripts/meta/sync-incremental.ts --days=7 --campaigns-only

# Apenas métricas
npx tsx scripts/meta/sync-incremental.ts --days=7 --metrics-only
```

**Quando usar:**
- ✅ Uso diário
- ✅ Atualização rápida
- ✅ Automação com cron

**Tempo:** 40s - 8min (depende do período)

---

### 3. `backfill-insights.js` - Backfill de Métricas
Sincroniza métricas dos últimos 30 dias com breakdowns (idade, gênero, device, etc).

```bash
npm run backfill:meta
# ou
node scripts/meta/backfill-insights.js
```

**Quando usar:**
- ✅ Após sync-campaigns.js
- ✅ Para análises detalhadas
- ✅ 1x por semana

**Tempo:** ~15-20 minutos

---

## 🎯 Fluxo Recomendado

### Primeira Vez
```bash
1. npm run sync:meta              # Sincroniza tudo
2. npm run backfill:meta          # Preenche métricas
```

### Uso Diário
```bash
npm run sync:meta:incremental -- --days=7
```

### Uso pela Interface
1. Acesse **Integrações**
2. Clique **"Atualizar Dados"** no card Meta Ads
3. Escolha período e tipo
4. Sincronize!

---

## 🔍 Verificar Dados

```bash
node scripts/check-meta-data.js
```

---

## 🧪 Testar Sincronização Incremental

```bash
bash scripts/test-sync-incremental.sh
```

---

## 📚 Documentação

- [Sincronização Incremental - Guia Completo](../../docs/sincronizacao-incremental.md)
- [Resumo de Implementação](../../SYNC-INCREMENTAL-SUMMARY.md)

---

## 🆘 Problemas Comuns

### "Missing required environment variable"
Verifique o `.env.local`:
```bash
cat .env.local | grep META_
```

### "Conta Meta não encontrada"
Execute primeiro:
```bash
npm run sync:meta
```

### Dados não atualizam
Tente aumentar o período:
```bash
npx tsx scripts/meta/sync-incremental.ts --days=15
```

---

Última atualização: 2025-11-01
