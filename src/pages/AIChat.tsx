import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Bot } from 'lucide-react';
import { ChatMessage } from '@/components/ai/ChatMessage';
import { ChatInput } from '@/components/ai/ChatInput';
import { SuggestedQuestions } from '@/components/ai/SuggestedQuestions';
import { useAIChat } from '@/hooks/useAIChat';
import type { ChatMessage as ChatMessageType } from '@/types/chat';

const WORKSPACE_ID = (import.meta.env.VITE_WORKSPACE_ID as string | undefined)?.trim() || '00000000-0000-0000-0000-000000000010';

export default function AIChat() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [initializing, setInitializing] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { loading, error, sendMessage, getConversations, getConversation } = useAIChat(WORKSPACE_ID);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversation = useCallback(async (id: string) => {
    const conversation = await getConversation(id);
    if (conversation?.messages) {
      setConversationId(id);
      setMessages(conversation.messages);
    }
  }, [getConversation]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      setInitializing(true);
      try {
        const conversations = await getConversations();
        if (!isMounted) {
          return;
        }

        if (conversations.length > 0) {
          await loadConversation(conversations[0].id);
        }
      } finally {
        if (isMounted) {
          setInitializing(false);
        }
      }
    };

    void init();

    return () => {
      isMounted = false;
    };
  }, [getConversations, loadConversation]);

  const handleSendMessage = async (messageText: string) => {
    // Add user message optimistically
    const userMessage: ChatMessageType = {
      id: Date.now().toString(),
      conversation_id: conversationId || '',
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);

    // Send to API
    const result = await sendMessage(messageText, conversationId);

    if (result) {
      // Update conversation ID if new conversation
      if (!conversationId) {
        setConversationId(result.conversationId);
      }

      setMessages((prev) => {
        const updated = !conversationId
          ? prev.map((msg) =>
              msg.id === userMessage.id
                ? { ...msg, conversation_id: result.conversationId }
                : msg
            )
          : prev;

        return [...updated, result.message];
      });
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setInitializing(false);
  };

  const showSuggestions = messages.length === 0 && !loading && !initializing;

  return (
    <div className="h-screen flex flex-col p-6 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Assistant</h1>
            <p className="text-sm text-muted-foreground">
              Analise suas campanhas e otimize sua performance
            </p>
          </div>
        </div>

        <Button onClick={handleNewConversation} variant="outline">
          <PlusCircle className="w-4 h-4 mr-2" />
          Nova Conversa
        </Button>
      </div>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="flex-1 overflow-y-auto p-6">
          {initializing ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              Carregando histórico da conversa...
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center mb-4">
                <Bot className="w-10 h-10 text-purple-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Como posso ajudar?</h2>
              <p className="text-muted-foreground mb-8 max-w-md">
                Faça perguntas sobre suas campanhas, peça análises ou solicite recomendações de otimização.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </CardContent>

        {/* Input Area */}
        <div className="border-t p-6 space-y-4">
          {showSuggestions && (
            <SuggestedQuestions
              onSelect={handleSendMessage}
              disabled={loading}
            />
          )}

          <ChatInput onSend={handleSendMessage} disabled={loading || initializing} />

          <p className="text-xs text-center text-muted-foreground">
            O AI Assistant pode cometer erros. Verifique informações importantes.
          </p>
        </div>
      </Card>
    </div>
  );
}
