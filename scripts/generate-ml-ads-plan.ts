import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { buildProductAdsPlan, renderProductAdsPlanMarkdown } from '../server/services/mercadolivre/product-ads-plan.service.js';

dotenv.config({ path: '.env.local' });

const parseArg = (name: string) => {
  const idx = process.argv.findIndex((arg) => arg === `--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
};

const BRAZIL_TIME_ZONE = 'America/Sao_Paulo';
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAZIL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const dateKey = () => DATE_FORMATTER.format(new Date());

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const formatPercent = (value: number | null) => (value === null ? '' : (value * 100).toFixed(2));
const formatNumber = (value: number | null) => (value === null ? '' : value.toFixed(4));
const formatMoney = (value: number | null) => (value === null ? '' : value.toFixed(2));

async function main() {
  const workspaceId = (parseArg('workspaceId')
    || process.env.WORKSPACE_ID
    || process.env.VITE_WORKSPACE_ID
    || '').trim();
  const outDir = (parseArg('outDir') || 'reports').trim();

  if (!workspaceId) {
    console.error('Missing workspace id. Use --workspaceId or set WORKSPACE_ID in .env.local');
    process.exit(1);
  }

  const plan = await buildProductAdsPlan(workspaceId);
  const markdown = renderProductAdsPlanMarkdown(plan);
  console.log(markdown);

  const stamp = dateKey();
  const baseName = `ml-product-ads-plan-${stamp}`;
  const mdPath = path.join(outDir, `${baseName}.md`);
  const csvPath = path.join(outDir, `${baseName}.csv`);

  const csvRows: string[] = [];
  csvRows.push([
    'campaign_name',
    'curve',
    'item_id',
    'title',
    'impressions_30d',
    'clicks_30d',
    'ctr_30d',
    'spend_30d',
    'cpc_30d',
    'sales_ads_30d',
    'revenue_ads_30d',
    'roas_30d',
    'acos_30d',
    'label',
    'action_recommended',
    'reason',
  ].join(','));

  for (const campaign of plan.campaigns) {
    for (const item of campaign.items) {
      const d30 = item.ranges.d30;
      csvRows.push([
        csvEscape(campaign.name),
        csvEscape(campaign.curve || ''),
        csvEscape(item.itemId),
        csvEscape(item.title || ''),
        csvEscape(d30.impressions),
        csvEscape(d30.clicks),
        csvEscape(formatPercent(d30.ctr)),
        csvEscape(formatMoney(d30.spend)),
        csvEscape(formatMoney(d30.cpc)),
        csvEscape(d30.sales),
        csvEscape(formatMoney(d30.revenue)),
        csvEscape(formatNumber(d30.roas)),
        csvEscape(formatPercent(d30.acos)),
        csvEscape(item.label),
        csvEscape(item.action),
        csvEscape(item.reason),
      ].join(','));
    }
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(mdPath, markdown, 'utf8');
  await fs.writeFile(csvPath, csvRows.join('\n'), 'utf8');

  console.error(`Saved markdown: ${mdPath}`);
  console.error(`Saved CSV: ${csvPath}`);

  if (plan.errors && plan.errors.length > 0) {
    console.error('Errors while fetching ads metrics:');
    for (const err of plan.errors) {
      console.error(`- ${err.range}: ${err.message}`);
    }
  }
}

main().catch((err) => {
  console.error('Failed to generate plan:', err);
  process.exit(1);
});
