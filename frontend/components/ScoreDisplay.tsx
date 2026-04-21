import React from 'react';
import { Sparkles } from 'lucide-react';
import { ScoreData } from '@/lib/types';

interface ScoreDisplayProps {
  scores: ScoreData;
}

export default function ScoreDisplay({ scores }: ScoreDisplayProps) {
  if (!scores) return null;

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <span className="font-semibold text-purple-900">Idea Analysis</span>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">{scores.novelty}</div>
          <div className="text-xs text-gray-600">Novelty</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">{scores.feasibility}</div>
          <div className="text-xs text-gray-600">Feasibility</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-pink-600">
            {scores.market_alignment}
          </div>
          <div className="text-xs text-gray-600">Market Fit</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-indigo-600">{scores.overall}</div>
          <div className="text-xs text-gray-600">Overall</div>
        </div>
      </div>
    </div>
  );
}