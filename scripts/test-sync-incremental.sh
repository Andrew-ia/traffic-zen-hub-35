#!/bin/bash
# Script de teste da sincronização incremental
# Verifica se a sincronização não duplica dados

set -e

echo "🧪 Teste de Sincronização Incremental"
echo "======================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Passo 1: Verificar dados antes
echo -e "${BLUE}📊 Passo 1: Contando dados antes da sincronização...${NC}"
BEFORE=$(node scripts/check-meta-data.js 2>&1 | grep "Métricas:" | awk '{print $2}')
echo -e "${GREEN}✅ Total de métricas ANTES: $BEFORE${NC}"
echo ""

# Passo 2: Sincronizar 1 dia
echo -e "${BLUE}🔄 Passo 2: Sincronizando último dia...${NC}"
npx tsx scripts/meta/sync-incremental.ts --days=1 --metrics-only > /dev/null 2>&1
echo -e "${GREEN}✅ Sincronização de 1 dia concluída${NC}"
echo ""

# Passo 3: Verificar dados depois
echo -e "${BLUE}📊 Passo 3: Contando dados depois da sincronização...${NC}"
AFTER=$(node scripts/check-meta-data.js 2>&1 | grep "Métricas:" | awk '{print $2}')
echo -e "${GREEN}✅ Total de métricas DEPOIS: $AFTER${NC}"
echo ""

# Passo 4: Sincronizar novamente o mesmo período
echo -e "${BLUE}🔄 Passo 4: Sincronizando novamente o mesmo período...${NC}"
npx tsx scripts/meta/sync-incremental.ts --days=1 --metrics-only > /dev/null 2>&1
echo -e "${GREEN}✅ Segunda sincronização concluída${NC}"
echo ""

# Passo 5: Verificar se não duplicou
echo -e "${BLUE}📊 Passo 5: Verificando se não houve duplicação...${NC}"
FINAL=$(node scripts/check-meta-data.js 2>&1 | grep "Métricas:" | awk '{print $2}')
echo -e "${GREEN}✅ Total de métricas FINAL: $FINAL${NC}"
echo ""

# Resultado
echo "======================================"
echo -e "${YELLOW}📋 RESULTADO DO TESTE:${NC}"
echo ""
echo "  Antes:              $BEFORE métricas"
echo "  Depois (1x sync):   $AFTER métricas"
echo "  Depois (2x sync):   $FINAL métricas"
echo ""

if [ "$AFTER" -eq "$FINAL" ]; then
  echo -e "${GREEN}✅ SUCESSO: Não houve duplicação!${NC}"
  echo -e "${GREEN}   O upsert está funcionando corretamente.${NC}"
  exit 0
else
  DIFF=$((FINAL - AFTER))
  echo -e "${YELLOW}⚠️  ATENÇÃO: Diferença de $DIFF registros${NC}"
  echo -e "${YELLOW}   Isso pode ser normal se houver dados novos no Meta.${NC}"
  exit 0
fi
