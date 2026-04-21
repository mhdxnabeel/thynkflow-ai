import React from 'react';
import { Menu } from 'lucide-react';

interface ChatHeaderProps {
  title?: string;
  userName?: string;
  onToggleSidebar: () => void;
}

export function ChatHeader({ title, userName, onToggleSidebar }: ChatHeaderProps) {
  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleSidebar}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {title || 'Ideation and Brainstorming Center'}
          </h2>
          <p className="text-xs text-gray-500">
            Powered by ThynkFlow System {userName && `• Logged in as ${userName}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
        <span className="text-xs font-medium text-green-600">Active</span>
      </div>
    </div>
  );
}