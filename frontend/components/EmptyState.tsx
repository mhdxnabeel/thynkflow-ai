import React from 'react';

export default function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center max-w-4xl mx-auto">
      <div className="bg-white border border-gray-200 rounded-2xl p-6 max-w-2xl w-full shadow-sm">
        <div className="flex gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
            T
          </div>
          <div>
            <p className="font-semibold text-gray-900 mb-1">ThynkFlow AI</p>
            <p className="text-sm text-gray-700 leading-relaxed">
              Hello! I'm ThynkFlow AI, your intelligent ideation assistant powered by artificial intelligence.
I can help you generate innovative ideas, overcome creative blocks, validate concepts with 
feasibility insights, and transform raw inspiration into structured, actionable strategies. 
How can I assist you today?
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}