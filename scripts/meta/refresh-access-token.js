#!/usr/bin/env node
/**
 * Gera e propaga automaticamente um novo META_ACCESS_TOKEN usando um System User.
 *
 * Pré-requisitos:
 * - META_BUSINESS_ID: ID do Business Manager dono do system user
 * - META_SYSTEM_USER_ID: ID do system user com permissões ads_read/ads_management
 * - META_SYSTEM_USER_TOKEN: Token “pai” desse system user (idealmente não expira)
 * - META_SYSTEM_USER_SCOPES: (opcional) lista separada por vírgula de escopos para o token gerado
 * - META_TOKEN_OUTPUT_FILES: (opcional) arquivos de env separados por vírgula a serem atualizados (.env.local,.env)
 *
 * Uso:
 *   META_SYSTEM_USER_TOKEN=xxx npm run meta:refresh-token
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const GRAPH_VERSION = "v19.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function assertEnv(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const message = payload?.error?.message ?? response.statusText ?? "Unknown error";
    throw new Error(`Meta API error ${response.status}: ${message}`);
  }

  return payload;
}

async function generateSystemUserToken({ businessId, systemUserId, scopes, managementToken }) {
  const body = new URLSearchParams({
    system_user_id: systemUserId,
    scope: scopes.join(","),
    access_token: managementToken,
  });

  const data = await fetchJson(`${GRAPH_URL}/${businessId}/generate_system_user_access_token`, {
    method: "POST",
    body,
  });

  const token = data?.access_token;
  if (!token) {
    throw new Error("Meta API did not return access_token");
  }

  return token;
}

async function updateEnvFile(filePath, newToken) {
  try {
    const absolute = path.resolve(process.cwd(), filePath);
    let content = "";
    try {
      content = await fs.readFile(absolute, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    const replacements = {
      META_ACCESS_TOKEN: newToken,
      VITE_META_ACCESS_TOKEN: newToken,
    };

    for (const [key, value] of Object.entries(replacements)) {
      const line = `${key}=${value}`;
      const regex = new RegExp(`^${key}=.*$`, "m");
      if (regex.test(content)) {
        content = content.replace(regex, line);
      } else {
        if (content && !content.endsWith("\n")) {
          content += "\n";
        }
        content += `${line}\n`;
      }
    }

    await fs.writeFile(absolute, content, "utf8");
    console.log(`✅ Atualizado ${filePath}`);
  } catch (error) {
    console.warn(`⚠️  Não foi possível atualizar ${filePath}: ${error.message}`);
  }
}

async function main() {
  const businessId = assertEnv(process.env.META_BUSINESS_ID, "META_BUSINESS_ID");
  const systemUserId = assertEnv(process.env.META_SYSTEM_USER_ID, "META_SYSTEM_USER_ID");
  const managementToken = assertEnv(process.env.META_SYSTEM_USER_TOKEN, "META_SYSTEM_USER_TOKEN");
  const scopesEnv = process.env.META_SYSTEM_USER_SCOPES ?? "ads_read,ads_management";
  const scopes = scopesEnv
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  if (scopes.length === 0) {
    throw new Error("META_SYSTEM_USER_SCOPES must contain at least one scope");
  }

  console.log("🔐 Gerando novo token do system user...");
  const accessToken = await generateSystemUserToken({
    businessId,
    systemUserId,
    scopes,
    managementToken,
  });

  console.log("✅ Token gerado com sucesso.");

  const outputTargets =
    process.env.META_TOKEN_OUTPUT_FILES?.split(",").map((item) => item.trim()).filter(Boolean) ?? [".env.local"];

  await Promise.all(outputTargets.map((target) => updateEnvFile(target, accessToken)));

  console.log("\nNovo token (use em secrets remotos se necessário):");
  console.log(accessToken);
  console.log("\nDica: execute `node scripts/setup-vault-secrets.js` para subir o valor ao Supabase Vault.");
}

main().catch((error) => {
  console.error("\n❌ Falha ao renovar o token:", error.message);
  process.exitCode = 1;
});
