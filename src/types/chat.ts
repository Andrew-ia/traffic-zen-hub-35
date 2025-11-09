// AI Chat Types

export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  metadata?: {
    tokens?: number;
    model?: string;
    dataContext?: string | string[];
    context?: {
      tool?: string;
      campaignName?: string;
      campaignId?: string;
      dateRange?: {
        startDate: string;
        endDate: string;
      };
      days?: number;
      metric?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  created_at: string;
}

export interface ChatConversation {
  id: string;
  workspace_id: string;
  user_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages?: ChatMessage[];
}

export interface SendMessageRequest {
  conversationId?: string;
  message: string;
  workspaceId: string;
}

export interface SendMessageResponse {
  success: boolean;
  conversationId: string;
  message: ChatMessage;
}

export interface DataQueryResult {
  type: 'campaigns' | 'metrics' | 'creatives' | 'insights';
  data: any;
  summary: string;
}
