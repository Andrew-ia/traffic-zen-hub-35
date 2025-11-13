#!/bin/bash
# =============================================================================
# SETUP DE CRON JOB PARA SYNC AUTOMÁTICO DO META ADS
# =============================================================================
# Este script configura um cron job que executa a sincronização diariamente
#
# Uso: bash setup-cron.sh
# =============================================================================

echo "🕐 Configurando Cron Job para sync diário do Meta Ads"
echo ""

# Detecta o diretório atual
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Define o comando do cron
CRON_COMMAND="0 3 * * * cd $SCRIPT_DIR && /usr/local/bin/npx --yes tsx scripts/meta/sync-incremental.ts --days=1 >> /tmp/meta-sync.log 2>&1"

# Verifica se já existe
if crontab -l 2>/dev/null | grep -q "meta/sync-incremental.ts"; then
    echo "⚠️  Cron job já existe!"
    echo ""
    echo "Cron jobs atuais:"
    crontab -l | grep "meta/sync-incremental.ts"
    echo ""
    read -p "Deseja substituir? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelado"
        exit 1
    fi

    # Remove o antigo
    crontab -l | grep -v "meta/sync-incremental.ts" | crontab -
fi

# Adiciona o novo
(crontab -l 2>/dev/null; echo "$CRON_COMMAND") | crontab -

echo "✅ Cron job configurado com sucesso!"
echo ""
echo "📋 Detalhes:"
echo "   Frequência: Diariamente às 3h da manhã"
echo "   Script: scripts/meta/sync-incremental.ts --days=1"
echo "   Log: /tmp/meta-sync.log"
echo ""
echo "🔍 Verificar cron jobs:"
echo "   crontab -l"
echo ""
echo "📝 Ver logs:"
echo "   tail -f /tmp/meta-sync.log"
echo ""
echo "❌ Remover cron job:"
echo "   crontab -l | grep -v 'meta/sync-incremental.ts' | crontab -"
echo ""
