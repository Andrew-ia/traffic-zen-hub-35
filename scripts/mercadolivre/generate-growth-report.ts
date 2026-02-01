import dotenv from 'dotenv';
import path from 'path';
import { promises as fs } from 'fs';
import { buildMercadoLivreGrowthReport, renderGrowthReportHtml, renderGrowthReportMarkdown } from '../../server/services/mercadolivre/growth-report.service.js';

dotenv.config({ path: '.env.local' });

async function run() {
  const workspaceId =
    process.env.WORKSPACE_ID ||
    process.env.MERCADO_LIVRE_DEFAULT_WORKSPACE_ID ||
    process.env.VITE_WORKSPACE_ID;

  if (!workspaceId) {
    console.error('Workspace ID not found. Set WORKSPACE_ID or MERCADO_LIVRE_DEFAULT_WORKSPACE_ID.');
    process.exit(1);
  }

  const report = await buildMercadoLivreGrowthReport(String(workspaceId));
  const dateLabel = new Date().toISOString().split('T')[0];
  const baseName = `ml_growth_report_${dateLabel}`;
  const outputDir = path.resolve(process.cwd(), 'reports');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, `${baseName}.json`), JSON.stringify(report, null, 2));
  await fs.writeFile(path.join(outputDir, `${baseName}.md`), renderGrowthReportMarkdown(report));
  await fs.writeFile(path.join(outputDir, `${baseName}.html`), renderGrowthReportHtml(report));

  console.log(`✅ Relatorio salvo em ${outputDir}/${baseName}.{json,md,html}`);
}

run().catch((err) => {
  console.error('Falha ao gerar relatorio:', err);
  process.exit(1);
});
