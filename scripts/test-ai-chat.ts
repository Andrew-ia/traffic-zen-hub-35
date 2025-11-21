
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_URL = 'http://localhost:3001';
const WORKSPACE_ID = process.env.WORKSPACE_ID || '00000000-0000-0000-0000-000000000010';

async function testChat() {
    console.log('🤖 Testing AI Chat API...');

    try {
        // 1. Send Message
        console.log('\n1. Sending message: "Qual foi o meu investimento total?"');
        const chatRes = await fetch(`${API_URL}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: 'Qual foi o meu investimento total nos últimos 30 dias?',
                workspaceId: WORKSPACE_ID
            })
        });

        if (!chatRes.ok) {
            const err = await chatRes.text();
            throw new Error(`Chat API failed: ${chatRes.status} ${err}`);
        }

        const chatData: any = await chatRes.json();
        console.log('✅ Chat Response:', chatData.message.content);
        console.log('   Conversation ID:', chatData.conversationId);

        const conversationId = chatData.conversationId;

        // 2. Get Conversations
        console.log('\n2. Fetching conversations...');
        const convRes = await fetch(`${API_URL}/api/ai/conversations?workspaceId=${WORKSPACE_ID}`);
        const convData: any = await convRes.json();
        console.log(`✅ Found ${convData.conversations.length} conversations.`);

        // 3. Get Specific Conversation
        console.log(`\n3. Fetching details for conversation ${conversationId}...`);
        const detailRes = await fetch(`${API_URL}/api/ai/conversations/${conversationId}`);
        const detailData: any = await detailRes.json();
        console.log(`✅ Conversation has ${detailData.conversation.messages.length} messages.`);

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

testChat();
