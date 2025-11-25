import type { Request, Response } from 'express';
import { getPool } from '../../config/database.js';

function getWorkspaceId(): string {
  const wid =
    process.env.META_WORKSPACE_ID ||
    process.env.WORKSPACE_ID ||
    process.env.SUPABASE_WORKSPACE_ID ||
    process.env.VITE_WORKSPACE_ID;

  if (!wid) {
    throw new Error(
      'Missing workspace id env. Set META_WORKSPACE_ID or WORKSPACE_ID (or VITE_WORKSPACE_ID) in .env.local'
    );
  }
  return wid.trim();
}

export async function getDemographics(req: Request, res: Response) {
  try {
    const { days, accountId, objective } = req.query;
    const workspaceId = getWorkspaceId();
    const pool = getPool();

    const daysNumber = Number(days || 7);
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - daysNumber);
    const dateStr = dateThreshold.toISOString().split('T')[0];

    const today = new Date().toISOString().split('T')[0];

    // Buscar dados de idade
    let ageQuery = `
      SELECT breakdown_value_key, impressions, clicks, spend
      FROM performance_metric_breakdowns pmb
      WHERE pmb.workspace_id = $1
        AND pmb.breakdown_key = 'age'
        AND pmb.metric_date >= $2
        AND pmb.metric_date < $3
    `;
    const ageParams: any[] = [workspaceId, dateStr, today];

    if (accountId && accountId !== 'all') {
      ageQuery += ` AND pmb.platform_account_id = $${ageParams.length + 1}`;
      ageParams.push(accountId);
    }

    if (objective) {
      ageQuery += ` AND EXISTS (
        SELECT 1 FROM campaigns c
        WHERE c.id = pmb.campaign_id AND UPPER(c.objective) = UPPER($${ageParams.length + 1})
      )`;
      ageParams.push(objective);
    }

    // Excluir contas demo quando não há filtro específico de conta
    ageQuery += ` AND NOT EXISTS (
      SELECT 1 FROM platform_accounts pa
      WHERE pa.id = pmb.platform_account_id
        AND pa.workspace_id = $1
        AND pa.platform_key = 'meta'
        AND pa.name ILIKE '%demo%'
    )`;

    const ageResult = await pool.query(ageQuery, ageParams);
    const ageData = ageResult.rows;

    // Buscar dados de gênero
    let genderQuery = `
      SELECT breakdown_value_key, impressions, clicks, spend
      FROM performance_metric_breakdowns pmb
      WHERE pmb.workspace_id = $1
        AND pmb.breakdown_key = 'gender'
        AND pmb.metric_date >= $2
        AND pmb.metric_date < $3
    `;
    const genderParams: any[] = [workspaceId, dateStr, today];

    if (accountId && accountId !== 'all') {
      genderQuery += ` AND pmb.platform_account_id = $${genderParams.length + 1}`;
      genderParams.push(accountId);
    }

    if (objective) {
      genderQuery += ` AND EXISTS (
        SELECT 1 FROM campaigns c
        WHERE c.id = pmb.campaign_id AND UPPER(c.objective) = UPPER($${genderParams.length + 1})
      )`;
      genderParams.push(objective);
    }

    // Excluir contas demo quando não há filtro específico de conta
    genderQuery += ` AND NOT EXISTS (
      SELECT 1 FROM platform_accounts pa
      WHERE pa.id = pmb.platform_account_id
        AND pa.workspace_id = $1
        AND pa.platform_key = 'meta'
        AND pa.name ILIKE '%demo%'
    )`;

    const genderResult = await pool.query(genderQuery, genderParams);
    const genderData = genderResult.rows;

    // Agregar dados de idade
    const ageMap = new Map<string, { impressions: number; clicks: number; spend: number }>();
    const normalizeAge = (key: string) => {
      // Remover prefixos como "age:" e padronizar
      const k = (key || '').toString();
      const cleaned = k.includes(':') ? k.split(':').pop()! : k;
      return cleaned;
    };
    ageData?.forEach((row: any) => {
      const key = normalizeAge(row.breakdown_value_key);
      const existing = ageMap.get(key) || { impressions: 0, clicks: 0, spend: 0 };
      ageMap.set(key, {
        impressions: existing.impressions + (Number(row.impressions) || 0),
        clicks: existing.clicks + (Number(row.clicks) || 0),
        spend: existing.spend + (Number(row.spend) || 0),
      });
    });

    // Agregar dados de gênero
    const genderMap = new Map<string, { impressions: number; clicks: number; spend: number }>();
    const normalizeGender = (key: string) => {
      const k = (key || '').toString().toLowerCase();
      const cleaned = k.includes(':') ? k.split(':').pop()! : k;
      if (cleaned === 'male') return 'male';
      if (cleaned === 'female') return 'female';
      return 'unknown';
    };
    genderData?.forEach((row: any) => {
      const key = normalizeGender(row.breakdown_value_key);
      const existing = genderMap.get(key) || { impressions: 0, clicks: 0, spend: 0 };
      genderMap.set(key, {
        impressions: existing.impressions + (Number(row.impressions) || 0),
        clicks: existing.clicks + (Number(row.clicks) || 0),
        spend: existing.spend + (Number(row.spend) || 0),
      });
    });

    // Calcular totais
    const totalAgeImpressions = Array.from(ageMap.values()).reduce((sum, v) => sum + v.impressions, 0);
    const totalGenderImpressions = Array.from(genderMap.values()).reduce((sum, v) => sum + v.impressions, 0);

    // Mapear nomes de idade
    const ageNameMap: Record<string, string> = {
      '13-17': '13-17',
      '18-24': '18-24',
      '25-34': '25-34',
      '35-44': '35-44',
      '45-54': '45-54',
      '55-64': '55-64',
      '65+': '65+',
    };

    // Mapear nomes de gênero
    const genderNameMap: Record<string, string> = {
      'male': 'Masculino',
      'female': 'Feminino',
      'unknown': 'Desconhecido',
    };

    // Formatar dados de idade
    const ageDataFormatted = Array.from(ageMap.entries())
      .map(([key, value]) => ({
        name: ageNameMap[key] || key,
        value: value.impressions,
        percentage: totalAgeImpressions > 0 ? (value.impressions / totalAgeImpressions) * 100 : 0,
      }))
      .sort((a, b) => {
        // Ordenar por faixa etária
        const order = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'];
        return order.indexOf(a.name) - order.indexOf(b.name);
      });

    // Formatar dados de gênero
    const genderDataFormatted = Array.from(genderMap.entries())
      .map(([key, value]) => ({
        name: genderNameMap[key.toLowerCase()] || key,
        value: value.impressions,
        percentage: totalGenderImpressions > 0 ? (value.impressions / totalGenderImpressions) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    return res.json({
      ageData: ageDataFormatted,
      genderData: genderDataFormatted,
    });
  } catch (error) {
    console.error('Error in getDemographics:', error);
    // Return empty data instead of error to prevent UI crashes
    return res.json({
      ageData: [],
      genderData: [],
    });
  }
}
