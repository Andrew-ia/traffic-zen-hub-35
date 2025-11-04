#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
});

const WORKSPACE_ID = '00000000-0000-0000-0000-000000000010';

async function main() {
  try {
    console.log('🔍 Checking creative_assets table...\n');

    // Check existing data
    const { rows } = await pool.query(
      'SELECT id, name, type, storage_url, thumbnail_url, created_at FROM creative_assets WHERE workspace_id = $1 LIMIT 10',
      [WORKSPACE_ID]
    );

    console.log(`Found ${rows.length} creatives in database:\n`);

    if (rows.length > 0) {
      rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.name}`);
        console.log(`   Type: ${row.type}`);
        console.log(`   Storage URL: ${row.storage_url || 'NULL'}`);
        console.log(`   Thumbnail URL: ${row.thumbnail_url || 'NULL'}`);
        console.log(`   Created: ${row.created_at}\n`);
      });
    } else {
      console.log('⚠️  No creatives found. Adding sample data...\n');

      // Add sample creatives with public image URLs
      const sampleCreatives = [
        {
          name: 'Banner Black Friday 2024',
          type: 'image',
          storage_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
          thumbnail_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=200',
          aspect_ratio: '16:9',
        },
        {
          name: 'Story Produto Destaque',
          type: 'image',
          storage_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
          thumbnail_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200',
          aspect_ratio: '9:16',
        },
        {
          name: 'Feed Post Novidades',
          type: 'image',
          storage_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800',
          thumbnail_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=200',
          aspect_ratio: '1:1',
        },
        {
          name: 'Vídeo Demonstração Produto',
          type: 'video',
          storage_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          thumbnail_url: 'https://images.unsplash.com/photo-1574169208507-84376144848b?w=200',
          aspect_ratio: '16:9',
          duration_seconds: 15,
        },
        {
          name: 'Carousel Lançamento',
          type: 'image',
          storage_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
          thumbnail_url: 'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=200',
          aspect_ratio: '1:1',
        },
        {
          name: 'Banner Desconto Progressivo',
          type: 'image',
          storage_url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800',
          thumbnail_url: 'https://images.unsplash.com/photo-1607082349566-187342175e2f?w=200',
          aspect_ratio: '16:9',
        },
      ];

      for (const creative of sampleCreatives) {
        await pool.query(
          `INSERT INTO creative_assets (
            workspace_id, name, type, storage_url, thumbnail_url,
            aspect_ratio, duration_seconds, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            WORKSPACE_ID,
            creative.name,
            creative.type,
            creative.storage_url,
            creative.thumbnail_url,
            creative.aspect_ratio,
            creative.duration_seconds || null,
            'active',
          ]
        );
        console.log(`✅ Added: ${creative.name}`);
      }

      console.log('\n✨ Sample data added successfully!');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
