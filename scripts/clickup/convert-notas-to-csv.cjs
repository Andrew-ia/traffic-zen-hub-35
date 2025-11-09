#!/usr/bin/env node
/**
 * Converte um arquivo de notas (.md ou .txt) em CSV hierárquico para importação no ClickUp.
 *
 * Uso:
 *   node scripts/clickup/convert-notas-to-csv.cjs <input.md> <output.csv>
 *
 * CSV gerado (header):
 *   name,description,status,due_date,start_date,tags,parent
 *
 * Heurísticas simples:
 * - Headings (#, ##, ###) definem contexto de parent (usamos última heading aplicável)
 * - Linhas com bullet (-, *) ou frases em caixa alta viram tarefas
 * - Status detectado por palavras-chave: ideia, avaliação, redação, design, aprovação, agendamento, concluído
 * - Datas no formato YYYY-MM-DD em qualquer lugar da linha viram due_date (start_date=igual se não houver outra)
 * - Tags inferidas por palavras: Meta, GA4, GTM, WhatsApp, Drive, Tray, Google Ads
 * - Parent automático: se a linha contiver "Anúncio" ou "Conjunto", e existir uma heading de campanha recente
 */

const fs = require('fs');
const path = require('path');

function stripAccents(str) {
  return (str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function detectStatus(line) {
  const s = stripAccents(line.toLowerCase());
  const map = [
    ['concluido', 'concluído'],
    ['aprovacao', 'aprovação'],
    ['avaliacao', 'avaliação'],
    ['redacao', 'redação'],
    ['design', 'design'],
    ['agendamento', 'agendamento'],
    ['ideia', 'ideia'],
  ];
  for (const [k, v] of map) {
    if (s.includes(k)) return v;
  }
  return 'ideia';
}

function detectDate(line) {
  const m = line.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return m ? m[1] : '';
}

function inferTags(line) {
  const s = line.toLowerCase();
  const tags = new Set();
  if (s.includes('meta')) tags.add('meta');
  if (s.includes('ga4')) tags.add('ga4');
  if (s.includes('gtm')) tags.add('gtm');
  if (s.includes('whatsapp')) tags.add('whatsapp');
  if (s.includes('drive')) tags.add('drive');
  if (s.includes('tray')) tags.add('tray');
  if (s.includes('google ads')) tags.add('ads');
  if (s.includes('creativo') || s.includes('criativo') || s.includes('imagem') || s.includes('video') || s.includes('carrossel')) tags.add('creatives');
  return Array.from(tags).join(',');
}

function cleanText(t) {
  return t.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').trim();
}

function isHeading(line) {
  return /^#{1,6}\s+/.test(line.trim());
}

function headingText(line) {
  return line.replace(/^#{1,6}\s+/, '').trim();
}

function shouldUseAsParent(text) {
  const s = stripAccents(text.toLowerCase());
  return s.includes('campanha');
}

function isTaskLine(line) {
  const t = line.trim();
  if (!t) return false;
  if (/^[-*]\s+/.test(t)) return true;
  // Frases em caixa alta com acentos removidos
  const sa = stripAccents(t);
  if (/^[A-Z0-9 _\-–—:,;()]+$/.test(sa) && sa.length >= 8) return true;
  return false;
}

function convert(inputText) {
  const lines = inputText.split(/\r?\n/);
  const rows = [];
  let currentParent = '';
  let lastCampaignParent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isHeading(line)) {
      const ht = headingText(line);
      currentParent = ht;
      if (shouldUseAsParent(ht)) {
        lastCampaignParent = ht;
      }
      continue;
    }
    if (!isTaskLine(line)) continue;

    const name = cleanText(line);
    const status = detectStatus(line);
    const date = detectDate(line);
    const tags = inferTags(line);
    let parent = '';
    const lower = stripAccents(name.toLowerCase());
    if ((lower.includes('anuncio') || lower.includes('conjunto')) && lastCampaignParent) {
      parent = lastCampaignParent;
    } else if (shouldUseAsParent(currentParent)) {
      parent = currentParent;
    }

    // Agrupar descrição: pegar linhas seguintes até linha vazia ou nova heading/bullet
    let description = '';
    let j = i + 1;
    while (j < lines.length) {
      const nl = lines[j];
      if (isHeading(nl) || isTaskLine(nl) || !nl.trim()) break;
      description += (description ? '\n' : '') + nl.trim();
      j++;
    }

    rows.push({ name, description, status, due_date: date, start_date: date, tags, parent });
  }
  return rows;
}

function toCSV(rows) {
  const header = 'name,description,status,due_date,start_date,tags,parent';
  const esc = (v) => {
    const s = (v == null ? '' : String(v));
    if (s.includes(',') || s.includes('\n') || s.includes('"')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const lines = [header];
  for (const r of rows) {
    lines.push([esc(r.name), esc(r.description), esc(r.status), esc(r.due_date), esc(r.start_date), esc(r.tags), esc(r.parent)].join(','));
  }
  return lines.join('\n');
}

function main() {
  const inPath = process.argv[2];
  const outPath = process.argv[3] || path.join('scripts/clickup', 'vermezzo-andrew-notas.csv');
  if (!inPath) {
    console.error('Uso: node scripts/clickup/convert-notas-to-csv.cjs <input.md|txt> <output.csv?>');
    process.exit(1);
  }
  const raw = fs.readFileSync(inPath, 'utf8');
  const rows = convert(raw);
  const csv = toCSV(rows);
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`✅ CSV gerado: ${outPath}`);
  console.log(`Linhas: ${rows.length}`);
}

if (require.main === module) {
  main();
}

