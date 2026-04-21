import React from 'react';

export default function LoadingIndicator() {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center text-white font-bold text-lg justify-center shadow-md">
            T
          </div>
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex gap-2">
          <div
            className="w-2 h-2 bg-purple-600 rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          ></div>
          <div
            className="w-2 h-2 bg-pink-600 rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          ></div>
          <div
            className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          ></div>
        </div>
      </div>
    </div>
  );
}