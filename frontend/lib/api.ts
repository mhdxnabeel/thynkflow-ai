import { ChatResponse, SessionResponse } from './types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Helper to get auth headers
function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('thynkflow_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

// Helper to handle API errors
async function handleResponse(response: Response) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(data.detail || `HTTP ${response.status}`);
  }
  return response.json();
}

export const api = {
  // ==================== AUTHENTICATION ====================
  async signup(name: string, email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    return handleResponse(response);
  },

  async verifyEmail(email: string, code: string) {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code })
    });
    return handleResponse(response);
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    return handleResponse(response);
  },

  async forgotPassword(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    return handleResponse(response);
  },

  async resetPassword(email: string, code: string, newPassword: string) {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, new_password: newPassword })
    });
    return handleResponse(response);
  },

  async getCurrentUser() {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // ==================== SESSIONS ====================
  async getSessions(userId: string) {
    const response = await fetch(`${API_BASE_URL}/sessions/${userId}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async getMessages(sessionId: string) {
    const response = await fetch(`${API_BASE_URL}/session/${sessionId}/messages`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async createSession(userId: string, title?: string): Promise<SessionResponse> {
    const response = await fetch(`${API_BASE_URL}/session/new`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ user_id: userId, title })
    });
    return handleResponse(response);
  },

  async sendMessage(
    message: string,
    sessionId: string,
    userId: string,
    mode: string = 'auto'
  ): Promise<ChatResponse> {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ message, session_id: sessionId, user_id: userId, mode })
    });
    return handleResponse(response);
  },

  async deleteSession(sessionId: string, userId: string) {
    const response = await fetch(`${API_BASE_URL}/session/${sessionId}?user_id=${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async updateSessionTitle(sessionId: string, title: string) {
    const response = await fetch(`${API_BASE_URL}/session/${sessionId}/title`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ title })
    });
    return handleResponse(response);
  },

  // ==================== FEEDBACK ====================
  async submitFeedback(type: string, message: string) {
    const response = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type, message })
    });
    return handleResponse(response);
  },

  // ==================== SYSTEM ====================
  async refreshModel() {
    const response = await fetch(`${API_BASE_URL}/refresh-model`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async getStats() {
    const response = await fetch(`${API_BASE_URL}/stats`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};