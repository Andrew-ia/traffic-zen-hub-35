-- Setup Instagram integration and credentials
-- Run this after getting your Instagram Business Account ID from Meta Business Suite

-- Variables you need to replace:
-- {{IG_USER_ID}} - Your Instagram Business Account ID (e.g., 211443329551349)
-- {{ACCESS_TOKEN}} - Your Meta Access Token (same as Meta Ads)
-- {{WORKSPACE_ID}} - Your workspace ID (e.g., 00000000-0000-0000-0000-000000000010)

-- 1. Insert Instagram integration
INSERT INTO integrations (
  workspace_id,
  platform_key,
  platform_category,
  platform_display_name,
  status
) VALUES (
  '{{WORKSPACE_ID}}'::uuid,
  'instagram',
  'social',
  'Instagram Insights',
  'active'
) ON CONFLICT (workspace_id, platform_key) DO UPDATE SET
  status = 'active',
  updated_at = now();

-- 2. Insert Instagram platform account
INSERT INTO platform_accounts (
  workspace_id,
  platform_key,
  external_id,
  account_name,
  account_type,
  is_active
) VALUES (
  '{{WORKSPACE_ID}}'::uuid,
  'instagram',
  '{{IG_USER_ID}}',
  'Instagram Business Account',
  'business',
  true
) ON CONFLICT (workspace_id, platform_key, external_id) DO UPDATE SET
  is_active = true,
  updated_at = now();

-- 3. Store encrypted credentials (you'll need to use the server API for this)
-- The credentials should be:
-- {
--   "igUserId": "{{IG_USER_ID}}",
--   "accessToken": "{{ACCESS_TOKEN}}"
-- }

-- To set the credentials, use the server API or run this node script:
-- node scripts/setup-instagram-credentials.js
