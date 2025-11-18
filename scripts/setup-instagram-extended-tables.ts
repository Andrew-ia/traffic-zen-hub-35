import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const { Client } = pg

async function main() {
  const connStr = (process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || '').trim()
  if (!connStr) throw new Error('Missing database connection string')
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })
  await client.connect()

  const sql = `
  CREATE TABLE IF NOT EXISTS instagram_profile_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    ig_user_id TEXT NOT NULL,
    username TEXT,
    biography TEXT,
    profile_picture_url TEXT,
    followers_count BIGINT,
    follows_count BIGINT,
    media_count BIGINT,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, ig_user_id, captured_at)
  );

  CREATE INDEX IF NOT EXISTS idx_instagram_profile_snapshots_ws ON instagram_profile_snapshots(workspace_id, captured_at DESC);

  CREATE TABLE IF NOT EXISTS instagram_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    caption TEXT,
    media_type TEXT,
    media_url TEXT,
    thumbnail_url TEXT,
    permalink TEXT,
    posted_at TIMESTAMPTZ,
    creative_asset_id UUID REFERENCES creative_assets(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, media_id)
  );

  CREATE INDEX IF NOT EXISTS idx_instagram_media_ws ON instagram_media(workspace_id, posted_at DESC);

  ALTER TABLE instagram_media
    ADD COLUMN IF NOT EXISTS like_count BIGINT,
    ADD COLUMN IF NOT EXISTS comments_count BIGINT;

  CREATE TABLE IF NOT EXISTS instagram_media_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    username TEXT,
    text TEXT,
    parent_id TEXT,
    commented_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, comment_id)
  );

  CREATE INDEX IF NOT EXISTS idx_instagram_media_comments_ws ON instagram_media_comments(workspace_id, media_id);

  CREATE TABLE IF NOT EXISTS instagram_media_insights_daily (
    id BIGSERIAL PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL,
    metric_date DATE NOT NULL,
    reach BIGINT,
    impressions BIGINT,
    likes BIGINT,
    comments BIGINT,
    shares BIGINT,
    saved BIGINT,
    video_views BIGINT,
    total_interactions BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, media_id, metric_date)
  );

  CREATE INDEX IF NOT EXISTS idx_instagram_media_insights_ws ON instagram_media_insights_daily(workspace_id, metric_date DESC);
  `

  await client.query(sql)
  console.log('✅ Instagram extended tables created')
  await client.end()
}

main().catch(err => {
  console.error('❌ Failed to setup tables:', err)
  process.exitCode = 1
})