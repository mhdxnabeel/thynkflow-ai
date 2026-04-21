import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Message, ScoreData } from '@/lib/types';

interface MessageBubbleProps {
  message: Message;
  userName?: string;
}

function ScoreCard({ score }: { score: ScoreData }) {
  const [showReasoning, setShowReasoning] = useState(false);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200';
    if (score >= 60) return 'bg-yellow-50 border-yellow-200';
    return 'bg-red-50 border-red-200';
  };

  const getScoreBadgeBg = (score: number) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
      {/* Header with Idea Title and Overall Score */}
      <div className="mb-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="text-xl font-bold text-gray-800 flex-grow leading-tight">
            💡 Idea #{score.idea_number}: {score.idea_title || score.idea_text}
          </h4>
          <div className={`px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap ${getScoreBadgeBg(score.overall)} ${getScoreColor(score.overall)}`}>
            {score.overall}/100
          </div>
        </div>
      </div>

      {/* Score Metrics Grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs font-semibold text-blue-700 mb-1">NOVELTY</p>
          <p className={`text-3xl font-bold ${getScoreColor(score.novelty)}`}>
            {score.novelty}
          </p>
          <p className="text-xs text-gray-500 mt-1">Originality</p>
        </div>
        <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs font-semibold text-purple-700 mb-1">FEASIBILITY</p>
          <p className={`text-3xl font-bold ${getScoreColor(score.feasibility)}`}>
            {score.feasibility}
          </p>
          <p className="text-xs text-gray-500 mt-1">Practicality</p>
        </div>
        <div className="text-center p-4 bg-pink-50 rounded-lg border border-pink-200">
          <p className="text-xs font-semibold text-pink-700 mb-1">MARKET FIT</p>
          <p className={`text-3xl font-bold ${getScoreColor(score.market_alignment)}`}>
            {score.market_alignment}
          </p>
          <p className="text-xs text-gray-500 mt-1">Alignment</p>
        </div>
      </div>

      {/* Reasoning Toggle */}
      {score.reasoning && (
        <div className="mt-4">
          <button
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex items-center justify-between w-full px-4 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 bg-gray-50 rounded-lg hover:bg-purple-50 transition-all"
          >
            <span>📋 {showReasoning ? 'Hide' : 'View'} Detailed Analysis</span>
            {showReasoning ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          
          {showReasoning && (
            <div className="mt-3 space-y-3 text-sm">
              {score.reasoning.novelty && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-bold text-blue-800 mb-1">💡 Novelty Analysis:</p>
                  <p className="text-gray-700 leading-relaxed">{score.reasoning.novelty}</p>
                </div>
              )}
              {score.reasoning.feasibility && (
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="font-bold text-purple-800 mb-1">⚙️ Feasibility Analysis:</p>
                  <p className="text-gray-700 leading-relaxed">{score.reasoning.feasibility}</p>
                </div>
              )}
              {score.reasoning.market_alignment && (
                <div className="p-3 bg-pink-50 rounded-lg border border-pink-200">
                  <p className="font-bold text-pink-800 mb-1">🎯 Market Fit Analysis:</p>
                  <p className="text-gray-700 leading-relaxed">{score.reasoning.market_alignment}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Format message content with proper markdown-like formatting
function formatMessageContent(content: string) {
  // Split by **text** pattern for bold
  const parts = content.split(/(\*\*.*?\*\*)/g);
  
  return parts.map((part, index) => {
    // Check if this part is wrapped in **
    if (part.startsWith('**') && part.endsWith('**')) {
      const boldText = part.slice(2, -2);
      return <strong key={index} className="font-bold text-gray-900">{boldText}</strong>;
    }
    return <span key={index}>{part}</span>;
  });
}

export default function MessageBubble({ message, userName }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const userInitial = userName?.charAt(0).toUpperCase() || 'U';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3 mb-6`}>
      {/* Assistant Avatar and Name - Left Side */}
      {!isUser && (
        <div className="flex flex-col items-center flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center text-white font-bold text-lg justify-center shadow-lg">
            T
          </div>
          <p className="mt-2 text-xs font-semibold text-gray-600">ThynkFlow</p>
        </div>
      )}

      {/* Message Content */}
      <div className={`max-w-2xl ${isUser ? 'order-1' : 'order-2'}`}>
        <div
          className={`rounded-2xl px-5 py-3 shadow-sm ${
            isUser
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
              : 'bg-white text-gray-800 border border-gray-200'
          }`}
        >
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {formatMessageContent(message.content)}
          </div>
        </div>

        {/* Score Cards - Only for Assistant Messages with scores */}
        {!isUser && message.scores && Array.isArray(message.scores) && message.scores.length > 0 && (
          <div className="mt-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px bg-gradient-to-r from-purple-300 to-pink-300 flex-grow"></div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                💎 Idea Analysis ({message.scores.length} {message.scores.length === 1 ? 'Idea' : 'Ideas'})
              </p>
              <div className="h-px bg-gradient-to-r from-pink-300 to-purple-300 flex-grow"></div>
            </div>
            
            {message.scores.map((score: ScoreData, index: number) => (
              <ScoreCard key={index} score={score} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs mt-2 ${isUser ? 'text-right text-gray-500' : 'text-left text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </p>
      </div>

      {/* User Avatar and Name - Right Side */}
      {isUser && (
        <div className="flex flex-col items-center flex-shrink-0 order-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg text-white font-bold text-lg">
            {userInitial}
          </div>
          <p className="text-xs font-semibold text-gray-600 mt-2">You</p>
        </div>
      )}
    </div>
  );
}