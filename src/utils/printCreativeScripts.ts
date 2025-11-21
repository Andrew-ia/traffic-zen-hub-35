import type { PMTaskFull } from '@/types/project-management';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function printCreativeScripts(task: PMTaskFull) {
    const campaignData = task.metadata?.campaign_data;

    if (!campaignData || !campaignData.adSets || campaignData.adSets.length === 0) {
        alert('Não há dados de campanha ou criativos para gerar roteiro.');
        return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Por favor, permita popups para gerar o roteiro.');
        return;
    }

    const styles = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
      
      body {
        font-family: 'Inter', sans-serif;
        line-height: 1.6;
        color: #1a1a1a;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
      }

      @media print {
        body {
          padding: 0;
        }
        .no-print {
          display: none;
        }
        .page-break {
          page-break-before: always;
        }
      }

      header {
        border-bottom: 2px solid #000;
        padding-bottom: 20px;
        margin-bottom: 40px;
      }

      h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 8px 0;
        text-transform: uppercase;
      }

      .meta-info {
        font-size: 14px;
        color: #666;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .ad-set {
        margin-bottom: 40px;
        border: 1px solid #e5e5e5;
        border-radius: 8px;
        overflow: hidden;
      }

      .ad-set-header {
        background: #f5f5f5;
        padding: 12px 20px;
        border-bottom: 1px solid #e5e5e5;
        font-weight: 600;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .creative {
        padding: 30px;
        border-bottom: 1px solid #e5e5e5;
      }

      .creative:last-child {
        border-bottom: none;
      }

      .creative-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 20px;
        font-size: 12px;
        color: #888;
        text-transform: uppercase;
      }

      .script-section {
        margin-bottom: 24px;
      }

      .script-label {
        font-size: 12px;
        font-weight: 700;
        color: #666;
        text-transform: uppercase;
        margin-bottom: 8px;
        letter-spacing: 0.05em;
      }

      .script-content {
        font-size: 18px; /* Large font for reading */
        font-weight: 400;
        white-space: pre-wrap;
        background: #fafafa;
        padding: 20px;
        border-radius: 4px;
        border-left: 4px solid #000;
      }

      .headline {
        font-size: 20px;
        font-weight: 700;
        margin-bottom: 16px;
      }

      .specs {
        display: flex;
        gap: 16px;
        margin-top: 16px;
        font-size: 12px;
        color: #666;
        background: #fff;
        padding: 10px;
        border: 1px solid #eee;
        border-radius: 4px;
      }

      .print-btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #000;
        color: #fff;
        border: none;
        padding: 12px 24px;
        border-radius: 50px;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        transition: transform 0.2s;
      }

      .print-btn:hover {
        transform: translateY(-2px);
      }
    </style>
  `;

    let content = `
    <header>
      <h1>Roteiro de Gravação</h1>
      <div class="meta-info">
        <div><strong>Campanha:</strong> ${campaignData.campaignName || task.name}</div>
        <div><strong>Data:</strong> ${format(new Date(), "dd 'de' MMMM, yyyy", { locale: ptBR })}</div>
        <div><strong>Objetivo:</strong> ${campaignData.objective || '-'}</div>
        <div><strong>Público:</strong> ${campaignData.ageMin || '?'} - ${campaignData.ageMax || '?'} anos</div>
      </div>
    </header>
  `;

    campaignData.adSets.forEach((adSet: any, index: number) => {
        if (!adSet.creatives || adSet.creatives.length === 0) return;

        content += `
      <div class="ad-set">
        <div class="ad-set-header">
          Conjunto ${index + 1}: ${adSet.name}
        </div>
    `;

        adSet.creatives.forEach((creative: any, cIndex: number) => {
            content += `
        <div class="creative ${index > 0 && cIndex === 0 ? 'page-break' : ''}">
          <div class="creative-header">
            <span>Criativo ${cIndex + 1}</span>
            <span>Formato: Vídeo / Reels</span>
          </div>

          ${creative.headline ? `
            <div class="script-section">
              <div class="script-label">Gancho / Título (Headline)</div>
              <div class="script-content headline">${creative.headline}</div>
            </div>
          ` : ''}

          ${creative.primaryText ? `
            <div class="script-section">
              <div class="script-label">Texto Principal (Corpo do Roteiro)</div>
              <div class="script-content">${creative.primaryText}</div>
            </div>
          ` : ''}

          <div class="specs">
            ${creative.cta ? `<div><strong>CTA:</strong> ${creative.cta}</div>` : ''}
            ${creative.description ? `<div><strong>Descrição:</strong> ${creative.description}</div>` : ''}
          </div>
        </div>
      `;
        });

        content += `</div>`;
    });

    content += `
    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir Roteiro</button>
    <script>
      // Auto-print on load
      window.onload = () => {
        setTimeout(() => {
          window.print();
        }, 500);
      };
    </script>
  `;

    printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Roteiro - ${task.name}</title>
      ${styles}
    </head>
    <body>
      ${content}
    </body>
    </html>
  `);

    printWindow.document.close();
}
