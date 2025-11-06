export interface ChatAgent {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  system_prompt: string;
  icon: string;
  color: string;
  is_default: boolean;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatConversation {
  id: string;
  workspace_id: string;
  chat_agent_id?: string;
  user_id?: string;
  title: string;
  created_at: string;
  updated_at: string;
  agent?: ChatAgent;
  message_count?: number;
  last_message?: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}
