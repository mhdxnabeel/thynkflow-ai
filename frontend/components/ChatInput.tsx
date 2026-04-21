import React from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
}: ChatInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white border border-gray-300 rounded-xl shadow-sm focus-within:border-purple-500 focus-within:ring-2 focus-within:ring-purple-200 transition-all">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask ThynkFlow about what you are thinking..."
            className="w-full px-4 py-3 bg-transparent text-gray-900 placeholder-gray-400 focus:outline-none resize-none text-sm"
            rows={1}
            disabled={disabled}
          />
          <div className="flex items-center justify-between px-4 pb-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Press Enter to send • Shift+Enter for new line
            </p>
            <button
              onClick={onSend}
              disabled={disabled || !value.trim()}
              className="p-2 mt-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">
          ThynkFlow AI • All Rights Reserved &copy; • 2025 <br />
          Made by Muhammad Nabeel • Yash Nimde • Pranay Munj • Yash Singh | Students at Atharva University Mumbai
        </p>
      </div>
    </div>
  );
}