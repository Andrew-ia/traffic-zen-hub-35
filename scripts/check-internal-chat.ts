import { getPool } from '../server/config/database.js';

async function checkInternalChatMessages() {
    const pool = getPool();

    console.log('\n💬 Verificando mensagens do Internal Chat...\n');
    console.log('═'.repeat(80));

    try {
        // Verificar salas
        const roomsResult = await pool.query(`
      SELECT 
        id,
        name,
        created_at,
        (SELECT COUNT(*) FROM room_members WHERE room_id = rooms.id) as member_count,
        (SELECT COUNT(*) FROM messages WHERE room_id = rooms.id) as message_count
      FROM rooms 
      ORDER BY created_at DESC 
      LIMIT 10
    `);

        console.log('\n📋 Salas de Chat:');
        console.log('─'.repeat(80));
        if (roomsResult.rows.length === 0) {
            console.log('❌ Nenhuma sala encontrada');
        } else {
            console.table(roomsResult.rows);
        }

        // Verificar mensagens
        const messagesResult = await pool.query(`
      SELECT 
        m.id,
        m.room_id,
        r.name as room_name,
        m.sender_id,
        u.full_name as sender_name,
        u.email as sender_email,
        LEFT(m.content, 50) as content_preview,
        m.image_url,
        m.created_at
      FROM messages m
      LEFT JOIN rooms r ON m.room_id = r.id
      LEFT JOIN users u ON m.sender_id::uuid = u.id
      ORDER BY m.created_at DESC 
      LIMIT 20
    `);

        console.log('\n💬 Últimas Mensagens:');
        console.log('─'.repeat(80));
        if (messagesResult.rows.length === 0) {
            console.log('❌ Nenhuma mensagem encontrada');
        } else {
            console.table(messagesResult.rows);
        }

        // Resumo geral
        const summaryResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM rooms) as total_rooms,
        (SELECT COUNT(*) FROM messages) as total_messages,
        (SELECT COUNT(*) FROM room_members) as total_memberships,
        (SELECT COUNT(DISTINCT sender_id) FROM messages) as unique_senders
    `);

        console.log('\n📊 Resumo Geral:');
        console.log('─'.repeat(80));
        console.table(summaryResult.rows);

        // Verificar se há mensagens com imagens
        const imagesResult = await pool.query(`
      SELECT COUNT(*) as messages_with_images
      FROM messages 
      WHERE image_url IS NOT NULL
    `);

        console.log('\n🖼️  Mensagens com Imagens:', imagesResult.rows[0].messages_with_images);

    } catch (error: any) {
        console.error('\n❌ Erro ao verificar mensagens:', error.message);
        console.error(error);
    }

    process.exit(0);
}

checkInternalChatMessages();
