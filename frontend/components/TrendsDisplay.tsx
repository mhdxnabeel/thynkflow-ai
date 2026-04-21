import React from 'react';
import { TrendingUp } from 'lucide-react';

interface TrendsDisplayProps {
  trends: string[];
}

export default function TrendsDisplay({ trends }: TrendsDisplayProps) {
  if (!trends || trends.length === 0) return null;

  return (
    <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
      <div className="flex items-center gap-2 mb-2">
        <TrendingUp className="w-4 h-4 text-blue-600" />
        <span className="font-semibold text-blue-900 text-sm">Related Trends</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {trends.map((trend, idx) => (
          <span
            key={idx}
            className="px-2 py-1 bg-white text-blue-700 text-xs rounded-full border border-blue-300"
          >
            {trend}
          </span>
        ))}
      </div>
    </div>
  );
}