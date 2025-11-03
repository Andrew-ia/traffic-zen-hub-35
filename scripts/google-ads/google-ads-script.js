/**
 * GOOGLE ADS SCRIPT - Exportar Dados de Campanhas
 *
 * COMO USAR:
 * 1. Acesse: https://ads.google.com
 * 2. Vá em "Ferramentas e Configurações" > "Bulk Actions" > "Scripts"
 * 3. Clique em "+ SCRIPT"
 * 4. Cole este código
 * 5. Clique em "Autorizar"
 * 6. Clique em "Executar"
 * 7. Copie a URL da planilha que aparece nos logs
 * 8. Execute: node scripts/google-ads/import-from-sheet.js --url=URL_DA_PLANILHA
 */

function main() {
  var DIAS = 30; // Últimos 30 dias

  Logger.log('🚀 Iniciando exportação de dados do Google Ads');
  Logger.log('📅 Período: últimos ' + DIAS + ' dias\n');

  // Criar planilha
  var spreadsheet = SpreadsheetApp.create('Google Ads Data - ' + new Date().toISOString().split('T')[0]);
  var sheet = spreadsheet.getActiveSheet();
  sheet.setName('Metricas Diarias');

  Logger.log('📊 Planilha criada: ' + spreadsheet.getUrl());

  // Headers
  var headers = [
    'Data',
    'Campaign ID',
    'Campaign Name',
    'Campaign Status',
    'Impressions',
    'Clicks',
    'Cost (BRL)',
    'Conversions',
    'Conversions Value',
    'CTR (%)',
    'CPC (BRL)',
    'Customer ID'
  ];

  sheet.appendRow(headers);

  // Formatar cabeçalho
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff');

  // Query para buscar dados
  var query =
    'SELECT ' +
    '  segments.date, ' +
    '  campaign.id, ' +
    '  campaign.name, ' +
    '  campaign.status, ' +
    '  metrics.impressions, ' +
    '  metrics.clicks, ' +
    '  metrics.cost_micros, ' +
    '  metrics.conversions, ' +
    '  metrics.conversions_value, ' +
    '  metrics.ctr, ' +
    '  metrics.average_cpc ' +
    'FROM campaign ' +
    'WHERE segments.date DURING LAST_' + DIAS + '_DAYS ' +
    '  AND campaign.status != "REMOVED" ' +
    'ORDER BY segments.date DESC, campaign.name';

  Logger.log('🔍 Buscando dados...');

  var report = AdsApp.report(query);
  var rows = report.rows();
  var count = 0;

  // Pegar Customer ID
  var account = AdsApp.currentAccount();
  var customerId = account.getCustomerId();

  Logger.log('🏢 Customer ID: ' + customerId);

  // Processar cada linha
  while (rows.hasNext()) {
    var row = rows.next();

    sheet.appendRow([
      row['segments.date'],
      row['campaign.id'],
      row['campaign.name'],
      row['campaign.status'],
      parseInt(row['metrics.impressions'] || 0),
      parseInt(row['metrics.clicks'] || 0),
      parseFloat(row['metrics.cost_micros'] || 0) / 1000000, // Converter de micros para BRL
      parseFloat(row['metrics.conversions'] || 0),
      parseFloat(row['metrics.conversions_value'] || 0),
      parseFloat(row['metrics.ctr'] || 0) * 100, // Converter para porcentagem
      parseFloat(row['metrics.average_cpc'] || 0) / 1000000, // Converter de micros para BRL
      customerId
    ]);

    count++;
  }

  Logger.log('✅ ' + count + ' registros exportados');

  // Formatar colunas
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  // Formatar números
  sheet.getRange(2, 5, count, 1).setNumberFormat('#,##0'); // Impressions
  sheet.getRange(2, 6, count, 1).setNumberFormat('#,##0'); // Clicks
  sheet.getRange(2, 7, count, 1).setNumberFormat('R$ #,##0.00'); // Cost
  sheet.getRange(2, 8, count, 1).setNumberFormat('#,##0.00'); // Conversions
  sheet.getRange(2, 9, count, 1).setNumberFormat('R$ #,##0.00'); // Conversions Value
  sheet.getRange(2, 10, count, 1).setNumberFormat('#,##0.00%'); // CTR
  sheet.getRange(2, 11, count, 1).setNumberFormat('R$ #,##0.00'); // CPC

  Logger.log('\n📊 PLANILHA CRIADA COM SUCESSO!');
  Logger.log('🔗 URL: ' + spreadsheet.getUrl());
  Logger.log('\n📝 PRÓXIMO PASSO:');
  Logger.log('Execute no seu terminal:');
  Logger.log('node scripts/google-ads/import-from-sheet.js --url=' + spreadsheet.getUrl());
  Logger.log('\n✅ Concluído!');
}
