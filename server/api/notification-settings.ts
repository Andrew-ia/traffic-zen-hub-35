import { Router } from "express";
import { getPool } from "../config/database.js";
import { TelegramNotificationService } from "../services/telegramNotification.service.js";

const router = Router();

/**
 * GET /api/notification-settings
 * Busca as configurações de notificação do workspace
 */
router.get("/", async (req, res) => {
    try {
        const { workspaceId, platform } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const pool = getPool();
        let query = `
            SELECT id, platform, enabled, config, created_at, updated_at
            FROM notification_settings
            WHERE workspace_id = $1
        `;
        const params: any[] = [workspaceId];

        if (platform) {
            query += ` AND platform = $2`;
            params.push(platform);
        }

        const result = await pool.query(query, params);

        // Remover informações sensíveis do bot_token
        const settings = result.rows.map((row) => ({
            ...row,
            config: {
                ...row.config,
                bot_token: row.config.bot_token ? "***" : null,
                chat_id: row.config.chat_id,
            },
        }));

        return res.json({ settings });
    } catch (error: any) {
        console.error("[Notification Settings] Erro ao buscar configurações:", error);
        return res.status(500).json({ error: "Erro ao buscar configurações" });
    }
});

/**
 * POST /api/notification-settings/telegram
 * Configura notificações do Telegram
 */
router.post("/telegram", async (req, res) => {
    try {
        const { workspaceId, botToken, chatId, enabled = true, skipTest = false } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        if (!botToken || !chatId) {
            return res.status(400).json({ error: "botToken e chatId são obrigatórios" });
        }

        if (!skipTest) {
            console.log("[Notification Settings] Testando configuração Telegram...");
            const testResult = await TelegramNotificationService.testConfiguration(botToken, chatId);
            if (!testResult.success) {
                return res.status(400).json({
                    error: "Configuração inválida",
                    details: testResult.error,
                });
            }
        }

        // Salvar configuração no banco
        const pool = getPool();
        await pool.query(
            `INSERT INTO notification_settings (workspace_id, platform, enabled, config)
             VALUES ($1, 'telegram', $2, $3)
             ON CONFLICT (workspace_id, platform)
             DO UPDATE SET
                enabled = EXCLUDED.enabled,
                config = EXCLUDED.config,
                updated_at = NOW()`,
            [workspaceId, enabled, JSON.stringify({ bot_token: botToken, chat_id: chatId })]
        );

        console.log(`[Notification Settings] ✅ Configuração Telegram salva para workspace ${workspaceId}`);

        return res.json({
            success: true,
            message: skipTest
                ? "Configuração salva com sucesso. Teste não executado."
                : "Configuração salva com sucesso. Mensagem de teste enviada!",
        });
    } catch (error: any) {
        console.error("[Notification Settings] Erro ao salvar configuração:", error);
        return res.status(500).json({ error: "Erro ao salvar configuração" });
    }
});

/**
 * PUT /api/notification-settings/:platform/toggle
 * Ativa/desativa notificações de uma plataforma
 */
router.put("/:platform/toggle", async (req, res) => {
    try {
        const { platform } = req.params;
        const { workspaceId, enabled } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        if (typeof enabled !== "boolean") {
            return res.status(400).json({ error: "enabled deve ser boolean" });
        }

        const pool = getPool();
        const result = await pool.query(
            `UPDATE notification_settings
             SET enabled = $1, updated_at = NOW()
             WHERE workspace_id = $2 AND platform = $3
             RETURNING *`,
            [enabled, workspaceId, platform]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Configuração não encontrada" });
        }

        console.log(`[Notification Settings] Notificações ${platform} ${enabled ? "ativadas" : "desativadas"} para workspace ${workspaceId}`);

        return res.json({
            success: true,
            enabled,
            message: `Notificações ${enabled ? "ativadas" : "desativadas"} com sucesso`,
        });
    } catch (error: any) {
        console.error("[Notification Settings] Erro ao alterar status:", error);
        return res.status(500).json({ error: "Erro ao alterar status" });
    }
});

/**
 * DELETE /api/notification-settings/:platform
 * Remove configuração de notificação
 */
router.delete("/:platform", async (req, res) => {
    try {
        const { platform } = req.params;
        const { workspaceId } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const pool = getPool();
        const result = await pool.query(
            `DELETE FROM notification_settings
             WHERE workspace_id = $1 AND platform = $2
             RETURNING *`,
            [workspaceId, platform]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Configuração não encontrada" });
        }

        console.log(`[Notification Settings] Configuração ${platform} removida para workspace ${workspaceId}`);

        return res.json({
            success: true,
            message: "Configuração removida com sucesso",
        });
    } catch (error: any) {
        console.error("[Notification Settings] Erro ao remover configuração:", error);
        return res.status(500).json({ error: "Erro ao remover configuração" });
    }
});

/**
 * POST /api/notification-settings/test
 * Envia notificação de teste
 */
router.post("/test", async (req, res) => {
    try {
        const { workspaceId, platform } = req.body;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        if (platform !== "telegram") {
            return res.status(400).json({ error: "Plataforma não suportada" });
        }

        const pool = getPool();
        const result = await pool.query(
            `SELECT config FROM notification_settings
             WHERE workspace_id = $1 AND platform = $2 AND enabled = true`,
            [workspaceId, platform]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Configuração não encontrada ou desativada" });
        }

        const config = result.rows[0].config;
        const testResult = await TelegramNotificationService.testConfiguration(
            config.bot_token,
            config.chat_id
        );

        if (testResult.success) {
            return res.json({
                success: true,
                message: "Notificação de teste enviada com sucesso!",
            });
        } else {
            return res.status(400).json({
                success: false,
                error: testResult.error,
            });
        }
    } catch (error: any) {
        console.error("[Notification Settings] Erro ao enviar teste:", error);
        return res.status(500).json({ error: "Erro ao enviar notificação de teste" });
    }
});

/**
 * GET /api/notification-settings/logs
 * Busca logs de notificações enviadas
 */
router.get("/logs", async (req, res) => {
    try {
        const { workspaceId, platform, limit = 50, offset = 0 } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ error: "workspaceId é obrigatório" });
        }

        const pool = getPool();
        let query = `
            SELECT *
            FROM notification_logs
            WHERE workspace_id = $1
        `;
        const params: any[] = [workspaceId];

        if (platform) {
            query += ` AND platform = $${params.length + 1}`;
            params.push(platform);
        }

        query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(Number(limit), Number(offset));

        const result = await pool.query(query, params);

        // Contar total
        const countResult = await pool.query(
            `SELECT COUNT(*) as total FROM notification_logs WHERE workspace_id = $1${
                platform ? " AND platform = $2" : ""
            }`,
            platform ? [workspaceId, platform] : [workspaceId]
        );

        return res.json({
            logs: result.rows,
            total: parseInt(countResult.rows[0].total),
            limit: Number(limit),
            offset: Number(offset),
        });
    } catch (error: any) {
        console.error("[Notification Settings] Erro ao buscar logs:", error);
        return res.status(500).json({ error: "Erro ao buscar logs" });
    }
});

export default router;
