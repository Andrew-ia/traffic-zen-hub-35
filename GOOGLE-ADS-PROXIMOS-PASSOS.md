# 📋 GOOGLE ADS - PRÓXIMOS PASSOS

## 🎯 SITUAÇÃO ATUAL

✅ **Tudo pronto do nosso lado:**
- OAuth funcionando perfeitamente
- Refresh Token obtido
- Banco de dados configurado
- Scripts de sincronização criados

⚠️ **Bloqueio identificado:**
- Developer Token está em modo "**Conta de teste**"
- API retorna erro 404 ao tentar buscar dados
- Precisa solicitar "**Acesso básico**" na Google Ads API

---

## 🔓 COMO DESBLOQUEAR (2 opções)

### Opção 1: Solicitar Acesso Básico (RECOMENDADO)

Na página que você abriu ([API Center](https://ads.google.com/aw/apicenter)):

1. Procure por uma seção chamada "**Nível de acesso**" ou "**Access Level**"
2. Deve haver um botão "**Solicitar acesso básico**" ou "**Request Basic Access**"
3. Clique e preencha o formulário:
   - **Finalidade**: Integração interna / Dashboard de relatórios
   - **Descrição**: Preciso acessar dados das minhas campanhas para criar relatórios consolidados
   - **Tipo de uso**: Somente leitura (read-only)
4. Envie a solicitação
5. **Tempo de aprovação**: Geralmente 1-3 dias úteis

**Depois que for aprovado, a sincronização funcionará automaticamente!**

---

### Opção 2: Usar Google Ads Scripts (SOLUÇÃO TEMPORÁRIA)

Enquanto aguarda aprovação da API, você pode usar Google Ads Scripts para exportar dados:

#### Passo 1: Criar o script no Google Ads

```javascript
function exportCampaignsToSheet() {
  var spreadsheet = SpreadsheetApp.create('Google Ads Data Export');
  var sheet = spreadsheet.getActiveSheet();

  // Headers
  sheet.appendRow(['Date', 'Campaign', 'Impressions', 'Clicks', 'Cost', 'Conversions']);

  // Query campaigns
  var report = AdsApp.report(
    'SELECT segments.date, campaign.name, metrics.impressions, ' +
    'metrics.clicks, metrics.cost_micros, metrics.conversions ' +
    'FROM campaign ' +
    'WHERE segments.date DURING LAST_30_DAYS ' +
    'AND campaign.status = "ENABLED" ' +
    'ORDER BY segments.date DESC'
  );

  var rows = report.rows();
  while (rows.hasNext()) {
    var row = rows.next();
    sheet.appendRow([
      row['segments.date'],
      row['campaign.name'],
      row['metrics.impressions'],
      row['metrics.clicks'],
      row['metrics.cost_micros'] / 1000000, // Convert to BRL
      row['metrics.conversions']
    ]);
  }

  Logger.log('Data exported to: ' + spreadsheet.getUrl());
}
```

#### Passo 2: Configurar execução automática

1. No Google Ads, vá em "Ferramentas" > "Scripts"
2. Crie um novo script
3. Cole o código acima
4. Configure para rodar diariamente
5. Compartilhe a planilha gerada

#### Passo 3: Importar dados da planilha

Crie um script que leia a planilha e insira no banco:

```bash
node scripts/google-ads/import-from-sheet.js --sheet-id=XXXXX
```

---

## 📊 ALTERNATIVA 3: Exportação Manual (ÚLTIMO RECURSO)

Se as opções acima não funcionarem:

### Exportar dados manualmente

1. Acesse: https://ads.google.com
2. Vá em "Relatórios" > "Relatórios predefinidos" > "Campanhas"
3. Selecione período (últimos 30 dias)
4. Adicione colunas:
   - Nome da campanha
   - Data
   - Impressões
   - Cliques
   - Custo
   - Conversões
   - Valor das conversões
5. Clique em "Download" > CSV

### Importar CSV para o banco

```bash
node scripts/google-ads/import-csv.js --file=campanhas.csv
```

*Nota: Precisaríamos criar esse script se você escolher essa opção*

---

## 🚀 QUANDO A API FUNCIONAR

Assim que o "Acesso básico" for aprovado, você só precisa executar:

```bash
# Sincronizar dados
node scripts/google-ads/sync-google-ads.js --days=30

# Verificar dados no banco
psql $SUPABASE_DATABASE_URL -c "SELECT COUNT(*) FROM ads_spend_google;"
```

E pronto! Os dados aparecerão automaticamente no dashboard.

---

## ❓ PERGUNTAS FREQUENTES

**P: Por quanto tempo o Developer Token fica em "teste"?**
R: Até você solicitar e ser aprovado para "Acesso básico". Não tem prazo automático.

**P: O que devo escrever no formulário de solicitação?**
R: Seja honesto e direto:
```
Título: Dashboard de relatórios interno
Descrição: Preciso acessar dados das minhas próprias campanhas do Google Ads
para criar um dashboard consolidado que compare performance com Meta Ads.
Uso será apenas leitura (read-only) para fins de análise e relatórios.
```

**P: E se eu for rejeitado?**
R: Improvável se você está solicitando para sua própria conta. Mas se acontecer,
use a Opção 2 (Google Ads Scripts) ou Opção 3 (Exportação manual).

**P: Posso testar com outra conta?**
R: Sim, mas a outra conta também precisaria do mesmo nível de acesso.

---

## 📞 PRÓXIMAS AÇÕES

**AGORA:**
1. Volte para a página do API Center
2. Procure "Nível de acesso" ou "Request Basic Access"
3. Solicite acesso básico
4. Tire um print da confirmação

**DEPOIS (1-3 dias):**
5. Aguarde email de aprovação do Google
6. Teste novamente: `node scripts/google-ads/test-rest-api.js`
7. Se funcionar, execute: `node scripts/google-ads/sync-google-ads.js --days=30`

**ENQUANTO ISSO (opcional):**
- Podemos implementar a Opção 2 (Google Ads Scripts) se você quiser dados imediatamente
- Ou implementar importação de CSV (Opção 3)
- Ou aguardar aprovação da API

---

**Me avise quando solicitar o acesso básico ou se preferir implementar uma das alternativas!** 🚀
