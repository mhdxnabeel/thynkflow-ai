export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  scores?: ScoreData[] | null;   //  Allow null or undefined
  trends?: string[] | null;      //  Allow null or undefined
  message_type?: string;
}

export interface Session {
  session_id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  prompt_type: string;
  message_count: number;
}

export interface ScoreData {
  idea_number?: number;
  idea_title?: string;           // NEW: Short catchy title for the idea
  idea_text?: string;            // Full idea description
  novelty: number;
  feasibility: number;
  market_alignment: number;
  overall: number;
  reasoning?: {
    novelty?: string;
    feasibility?: string;
    market_alignment?: string;
  };
}

export interface ChatResponse {
  response: string;
  session_id: string;
  prompt_type: string;
  scores?: ScoreData[] | null;
  trends?: string[] | null;
  ideas_count?: number;
  timestamp: string;
  title?: string;
}

export interface SessionResponse {
  session_id: string;
  user_id: string;
  title: string;
  message: string;
  timestamp: string;
}