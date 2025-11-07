'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { BookOpen, Shield, Code, BarChart, Briefcase } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ToolType } from '@/lib/tools-config';

interface ToolButton {
  label: string;
  toolType: ToolType | 'devotional'; // 'devotional' is special - goes to route
  icon: React.ReactNode;
  gradient: string;
}

interface ToolCarouselProps {
  onToolSelect: (toolType: ToolType) => void;
  isLoading: boolean;
}

export default function ToolCarousel({ onToolSelect, isLoading }: ToolCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const tools: ToolButton[] = [
    {
      label: 'DAILY DEVOTIONAL',
      toolType: 'devotional',
      icon: <BookOpen className="h-4 w-4" />,
      gradient: 'from-blue-900 to-blue-800' // Dark navy blue
    },
    {
      label: 'BIBLE RESEARCH',
      toolType: 'deep-bible-research',
      icon: <BookOpen className="h-4 w-4" />,
      gradient: 'from-blue-900 to-blue-800' // Dark navy blue
    },
    {
      label: 'APOLOGETICS',
      toolType: 'apologetics-helper',
      icon: <Shield className="h-4 w-4" />,
      gradient: 'from-blue-900 to-blue-800' // Dark navy blue
    },
    {
      label: 'CODING ASSISTANT',
      toolType: 'coding-assistant',
      icon: <Code className="h-4 w-4" />,
      gradient: 'from-blue-900 to-blue-800' // Dark navy blue
    },
    {
      label: 'DATA ANALYSIS',
      toolType: 'data-analysis',
      icon: <BarChart className="h-4 w-4" />,
      gradient: 'from-blue-900 to-blue-800' // Dark navy blue
    },
    {
      label: 'BUSINESS STRATEGY',
      toolType: 'business-strategy',
      icon: <Briefcase className="h-4 w-4" />,
      gradient: 'from-blue-900 to-blue-800' // Dark navy blue
    }
  ];

  const handleButtonClick = (tool: ToolButton) => {
    if (tool.toolType === 'devotional') {
      router.push('/devotional');
    } else {
      onToolSelect(tool.toolType as ToolType);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-transparent">
      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide flex gap-3 py-2 scroll-smooth bg-transparent"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {tools.map((tool, index) => (
          <Button
            key={index}
            type="button"
            onClick={() => handleButtonClick(tool)}
            disabled={isLoading}
            className={`flex-shrink-0 min-w-[160px] h-12 bg-gradient-to-r ${tool.gradient} hover:opacity-90 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2`}
          >
            {tool.icon}
            <span className="text-xs tracking-wider">{tool.label}</span>
          </Button>
        ))}
      </div>

      {/* Hide scrollbar CSS */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
