import { useState, useCallback } from 'react';
import type { ChatMessage, ChatConversation, SendMessageRequest } from '@/types/chat';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function useAIChat(workspaceId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (
    message: string,
    conversationId?: string
  ): Promise<{ conversationId: string; message: ChatMessage } | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
          workspaceId,
        } as SendMessageRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar mensagem');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const getConversations = useCallback(async (): Promise<ChatConversation[]> => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/conversations?workspaceId=${workspaceId}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar conversas');
      }

      const data = await response.json();
      return data.conversations || [];
    } catch (err) {
      console.error('Error fetching conversations:', err);
      return [];
    }
  }, [workspaceId]);

  const getConversation = useCallback(async (conversationId: string): Promise<ChatConversation | null> => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/conversations/${conversationId}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar conversa');
      }

      const data = await response.json();
      return data.conversation;
    } catch (err) {
      console.error('Error fetching conversation:', err);
      return null;
    }
  }, []);

  const deleteConversation = useCallback(async (conversationId: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      return false;
    }
  }, []);

  return {
    loading,
    error,
    sendMessage,
    getConversations,
    getConversation,
    deleteConversation,
  };
}
