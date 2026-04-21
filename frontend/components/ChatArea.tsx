import React from 'react';
import { Message } from '@/lib/types';
import MessageBubble from './MessageBubble';
import EmptyState from './EmptyState';
import LoadingIndicator from './LoadingIndicator';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  userName?: string;
}

export default function ChatArea({
  messages,
  isLoading,
  messagesEndRef,
  userName,
}: ChatAreaProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-6">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg, idx) => (
            <MessageBubble key={idx} message={msg} userName={userName} />
          ))}
          {isLoading && <LoadingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}