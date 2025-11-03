# 🚀 GUIA RÁPIDO - Google Ads Script (Solução Temporária)

## 📋 O QUE VAMOS FAZER

Como o Developer Token ainda não está aprovado, vamos usar **Google Ads Scripts** para exportar os dados da sua conta real.

**Tempo total: ~5 minutos**

---

## 🎯 PASSO A PASSO

### 1️⃣ Abrir Google Ads Scripts

1. Acesse: https://ads.google.com
2. Clique em **"Ferramentas e Configurações"** (ícone de chave inglesa no canto superior direito)
3. Em **"BULK ACTIONS"**, clique em **"Scripts"**
4. Clique no botão **"+ NOVO SCRIPT"** (azul)

---

### 2️⃣ Colar o Script

1. **Abra o arquivo:** `scripts/google-ads/google-ads-script.js`
2. **Copie TODO o conteúdo** (Cmd+A, Cmd+C)
3. **Cole no editor do Google Ads** (apague o código que já está lá)
4. Dê um nome: "Exportar Dados para Dashboard"
5. Clique em **"Salvar"** (canto superior direito)

---

### 3️⃣ Autorizar e Executar

1. Clique em **"Autorizar"** (botão no topo)
2. Selecione sua conta Google
3. Clique em **"Permitir"** (pode aparecer um aviso de segurança, clique em "Avançado" e depois "Ir para...")
4. Clique em **"Executar"** (▶️ botão de play)
5. Aguarde ~10-30 segundos

---

### 4️⃣ Copiar a URL da Planilha

Quando terminar, você verá nos **"Logs"** (painel inferior):

```
📊 Planilha criada: https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXX
✅ 350 registros exportados
📝 PRÓXIMO PASSO:
Execute no seu terminal:
node scripts/google-ads/import-from-sheet.js --url=https://docs.google.com/spreadsheets/d/XXXXXXXXXXXXXXXXX
```

**Copie essa URL completa!**

---

### 5️⃣ Importar para o Banco de Dados

No seu terminal (não no Cloud Shell, no seu Mac):

```bash
node scripts/google-ads/import-from-sheet.js --url=URL_QUE_VOCE_COPIOU
```

Exemplo:
```bash
node scripts/google-ads/import-from-sheet.js --url=https://docs.google.com/spreadsheets/d/1ABC...XYZ
```

---

## ✅ O QUE VAI ACONTECER

```
📥 Importando dados do Google Sheets

📊 Planilha: 1ABC...XYZ
🆔 Workspace: 00000000-0000-0000-0000-000000000010

🔐 Autenticando no Google...
✅ Autenticado!

📖 Lendo dados da planilha...
✅ 350 registros encontrados

🔌 Conectando ao banco de dados...
✅ Conectado!

💾 Importando dados...

✅ Importação concluída!
   ➕ 350 novos registros
   🔄 0 registros atualizados

📊 Resumo dos dados:
   Total de registros: 350
   Período: 2024-10-03 a 2024-11-02
   Total de impressões: 125,432
   Total de cliques: 3,245
   Total gasto: R$ 15,234.50

🎉 Tudo pronto! Dados do Google Ads importados com sucesso!
```

---

## 🔄 SINCRONIZAÇÃO AUTOMÁTICA

Você pode configurar o script para rodar **automaticamente todo dia**:

### No Google Ads:

1. Abra o script que você criou
2. Clique em **"Executar"** dropdown → **"Adicionar programação"**
3. Configure:
   - **Frequência:** Diário
   - **Horário:** 06:00 (ou qualquer horário)
4. Clique em **"Salvar"**

Agora o Google Ads vai criar uma planilha nova todo dia!

### No seu servidor (futuro):

Crie um cron job para rodar o import automaticamente:

```bash
# Adicionar ao crontab
0 7 * * * cd /path/to/traffic-zen-hub-35 && node scripts/google-ads/import-from-sheet.js --url=URL_DA_PLANILHA >> /var/log/google-ads-import.log 2>&1
```

---

## ❓ DÚVIDAS COMUNS

### P: Preciso fazer isso todo dia?

R: Só até o Developer Token ser aprovado. Depois você usa o script automático:
```bash
node scripts/google-ads/sync-google-ads.js --days=30
```

### P: A planilha fica pública?

R: Não! Ela fica privada na sua conta. Só você tem acesso.

### P: Posso deletar a planilha depois de importar?

R: Sim! Depois de importar, pode deletar ou deixar lá como backup.

### P: E se eu quiser dados de mais de 30 dias?

R: Edite a linha 20 do script:
```javascript
var DIAS = 90; // Mude de 30 para 90
```

---

## 🎯 QUANDO O DEVELOPER TOKEN FOR APROVADO

Quando o Google aprovar seu Developer Token (1-3 dias), você pode:

1. **Parar de usar o Google Ads Script**
2. **Usar sincronização direta:**
   ```bash
   node scripts/google-ads/sync-google-ads.js --days=30
   ```
3. **Configurar cron job** para rodar automaticamente

Todos os dados históricos que você importou via planilha continuam no banco! 🎉

---

## 📞 PRÓXIMO PASSO

**AGORA:** Execute os passos 1-5 acima para importar seus dados!

**DEPOIS:** Solicite acesso básico no API Center para usar a API diretamente.

---

**Qualquer dúvida, me avise!** 🚀
