#!/usr/bin/env node
/**
 * split-csv.cjs
 *
 * Separa um CSV preparado (name,description,status,due_date,start_date,tags,parent)
 * em dois arquivos: "campanhas" (itens de campanha/anúncio) e
 * "implementações" (logs de configuração/validação/etc.).
 *
 * Uso:
 *   node scripts/clickup/split-csv.cjs --src scripts/clickup/vermezzo-notes-parent.csv \
 *     --camp scripts/clickup/vermezzo-campanhas.csv --ops scripts/clickup/vermezzo-implementacoes.csv
 */

const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--src') out.src = args[++i];
    else if (a === '--camp') out.camp = args[++i];
    else if (a === '--ops') out.ops = args[++i];
    else if (a.startsWith('--src=')) out.src = a.split('=')[1];
    else if (a.startsWith('--camp=')) out.camp = a.split('=')[1];
    else if (a.startsWith('--ops=')) out.ops = a.split('=')[1];
  }
  return out;
}

function ensureFileExists(p) {
  if (!p) throw new Error('Parâmetro ausente: --src <arquivo.csv>');
  if (!fs.existsSync(p)) throw new Error(`Arquivo não encontrado: ${p}`);
}

function readFileNormalized(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
}

function splitRecordsPreservingQuotedNewlines(text) {
  const lines = text.split('\n');
  const records = [];
  let buf = '';
  let quoteCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (buf.length > 0) buf += '\n' + line; else buf = line;
    quoteCount = (buf.match(/\"/g) || []).length;
    if (quoteCount % 2 === 0) {
      records.push(buf);
      buf = '';
      quoteCount = 0;
    }
  }
  if (buf.length > 0) records.push(buf);
  return records.filter(r => r.trim().length > 0);
}

function parseCsvRow(row) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') { // aspas escapadas ""
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function csvEscapeField(val) {
  if (val == null) val = '';
  const needsQuote = /[",\n]/.test(val);
  let out = String(val).replace(/"/g, '""');
  return needsQuote ? '"' + out + '"' : out;
}

function toCSV(rows, headerOrder) {
  const header = headerOrder.map(csvEscapeField).join(',');
  const body = rows.map(r => headerOrder.map(k => csvEscapeField(r[k])).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

function stripAccents(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isCampaignName(name) {
  const n = stripAccents(String(name || '').toLowerCase());
  return (
    n.includes('campanha') ||
    n.includes('anuncio') ||
    n.includes('conjunto de anuncios')
  );
}

function main() {
  const { src, camp, ops } = parseArgs();
  ensureFileExists(src);
  const outCamp = camp || path.join(path.dirname(src), 'vermezzo-campanhas.csv');
  const outOps = ops || path.join(path.dirname(src), 'vermezzo-implementacoes.csv');

  const text = readFileNormalized(src);
  const records = splitRecordsPreservingQuotedNewlines(text);
  if (records.length < 2) throw new Error('CSV vazio ou sem registros.');

  const header = parseCsvRow(records[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < records.length; i++) {
    const cols = parseCsvRow(records[i]);
    const obj = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = cols[j] != null ? cols[j] : '';
    }
    rows.push(obj);
  }

  const campanhas = [];
  const implementacoes = [];
  for (const r of rows) {
    if (isCampaignName(r.name)) campanhas.push(r); else implementacoes.push(r);
  }

  const csvCamp = toCSV(campanhas, header);
  const csvOps = toCSV(implementacoes, header);
  fs.writeFileSync(outCamp, csvCamp, 'utf8');
  fs.writeFileSync(outOps, csvOps, 'utf8');

  console.log(`✅ Arquivos gerados:`);
  console.log(`  Campanhas: ${outCamp} (linhas: ${campanhas.length})`);
  console.log(`  Implementações: ${outOps} (linhas: ${implementacoes.length})`);
}

try {
  main();
} catch (err) {
  console.error('Erro ao dividir CSV:', err.message);
  process.exit(1);
}

