'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../components/Sidebar';
import { ChatHeader } from '../components/ChatHeader';
import ChatArea from '../components/ChatArea';
import ChatInput from '../components/ChatInput';
import { api } from '../lib/api';
import { Session, Message } from '../lib/types';

// Auth wrapper to check if user is logged in
function useAuth() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('thynkflow_token');
    const userData = localStorage.getItem('thynkflow_user');

    if (!token || !userData) {
      router.push('/auth');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
    } catch (error) {
      console.error('Invalid user data:', error);
      router.push('/auth');
    } finally {
      setLoading(false);
    }
  }, [router]);

  return { user, setUser, loading };
}

export default function Home() {
  const { user, setUser, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount (only after user is authenticated)
  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  // Load messages when session changes
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    }
  }, [currentSessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4 animate-pulse">
            T
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If no user, return null (will redirect)
  if (!user) {
    return null;
  }

  const loadSessions = async () => {
    try {
      const data = await api.getSessions(user.user_id);
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      // If unauthorized, redirect to login
      if (error instanceof Error && error.message.includes('401')) {
        localStorage.removeItem('thynkflow_token');
        localStorage.removeItem('thynkflow_user');
        router.push('/auth');
      }
    }
  };

  const loadMessages = async (sessionId: string) => {
    try {
      const data = await api.getMessages(sessionId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
    }
  };

  const createNewSession = async () => {
    try {
      const data = await api.createSession(user.user_id, undefined);
      setCurrentSessionId(data.session_id);
      setMessages([]);
      await loadSessions();
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = inputMessage;
    setInputMessage('');
    setIsLoading(true);

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      let sessionId = currentSessionId;

      // Create session if none exists
      if (!sessionId) {
        const newSessionData = await api.createSession(user.user_id, undefined);
        sessionId = newSessionData.session_id;
        setCurrentSessionId(sessionId);
      }

      // Send message to backend
      const data = await api.sendMessage(userMessage, sessionId, user.user_id, 'auto');

      // Add assistant message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.response,
          timestamp: data.timestamp,
          scores: data.scores,
          trends: data.trends || undefined,
          message_type: data.prompt_type,
        },
      ]);

      // Update session title if backend generated one
      if (data.title) {
        setSessions((prev) =>
          prev.map((s) =>
            s.session_id === sessionId ? { ...s, title: data.title ?? s.title } : s
          )
        );
      }

      await loadSessions();
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, there was an error processing your message.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId, user.user_id);
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
      await loadSessions();
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const updateSessionTitle = async (sessionId: string, newTitle: string) => {
    try {
      await api.updateSessionTitle(sessionId, newTitle);
      setEditingSessionId(null);
      await loadSessions();
    } catch (error) {
      console.error('Error updating title:', error);
    }
  };

  const handleEditSession = (sessionId: string, title: string) => {
    setEditingSessionId(sessionId);
    setEditTitle(title);
  };

  const handleLogout = () => {
    // Clear local storage
    localStorage.removeItem('thynkflow_token');
    localStorage.removeItem('thynkflow_user');
    
    // Redirect to auth page
    router.push('/auth');
  };

  const handleUserUpdate = (updatedUser: any) => {
    setUser(updatedUser);
  };

  const currentSession = sessions.find((s) => s.session_id === currentSessionId);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      {sidebarOpen && (
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          editingSessionId={editingSessionId}
          editTitle={editTitle}
          user={user}
          onCreateSession={createNewSession}
          onSelectSession={setCurrentSessionId}
          onEditSession={handleEditSession}
          onUpdateTitle={updateSessionTitle}
          onCancelEdit={() => setEditingSessionId(null)}
          onDeleteSession={deleteSession}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
          setEditTitle={setEditTitle}
        />
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <ChatHeader
          title={currentSession?.title}
          userName={user?.name}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <ChatArea
          messages={messages}
          isLoading={isLoading}
          messagesEndRef={messagesEndRef}
          userName={user?.name}
        />

        <ChatInput
          value={inputMessage}
          onChange={setInputMessage}
          onSend={sendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}