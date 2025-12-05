-- Script para limpar métricas duplicadas e adicionar constraint

-- 1. Criar uma tabela temporária com apenas os registros mais recentes por (ad_set_id, metric_date, granularity)
CREATE TEMP TABLE latest_metrics AS
SELECT DISTINCT ON (ad_set_id, metric_date, granularity)
  id,
  ad_set_id,
  metric_date,
  granularity,
  synced_at
FROM performance_metrics
WHERE granularity = 'day'
ORDER BY ad_set_id, metric_date, granularity, synced_at DESC;

-- 2. Contar quantos duplicados temos
SELECT 
  COUNT(*) as total_records,
  (SELECT COUNT(*) FROM latest_metrics) as unique_records,
  COUNT(*) - (SELECT COUNT(*) FROM latest_metrics) as duplicates_to_remove
FROM performance_metrics
WHERE granularity = 'day';

-- 3. Deletar os duplicados (mantendo apenas os mais recentes)
DELETE FROM performance_metrics
WHERE granularity = 'day'
AND id NOT IN (SELECT id FROM latest_metrics);

-- 4. Adicionar constraint UNIQUE para prevenir futuros duplicados
-- Nota: Isso pode falhar se já existir, mas não tem problema
ALTER TABLE performance_metrics
ADD CONSTRAINT unique_metric_per_day 
UNIQUE (ad_set_id, metric_date, granularity);

-- 5. Verificar o resultado
SELECT 
  metric_date,
  COUNT(*) as num_records,
  SUM(spend) as total_spend
FROM performance_metrics
WHERE granularity = 'day'
AND metric_date >= '2025-12-01'
GROUP BY metric_date
ORDER BY metric_date DESC;
