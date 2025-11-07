'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, BookOpen, Shield, Code, BarChart, Briefcase, Mail, MessageSquare } from 'lucide-react';
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
      gradient: 'from-blue-900 to-blue-800'
    },
    {
      label: 'BIBLE RESEARCH',
      toolType: 'deep-bible-research',
      icon: <BookOpen className="h-4 w-4" />,
      gradient: 'from-purple-900 to-purple-800'
    },
    {
      label: 'APOLOGETICS',
      toolType: 'apologetics-helper',
      icon: <Shield className="h-4 w-4" />,
      gradient: 'from-red-900 to-red-800'
    },
    {
      label: 'CODING ASSISTANT',
      toolType: 'coding-assistant',
      icon: <Code className="h-4 w-4" />,
      gradient: 'from-green-900 to-green-800'
    },
    {
      label: 'DATA ANALYSIS',
      toolType: 'data-analysis',
      icon: <BarChart className="h-4 w-4" />,
      gradient: 'from-cyan-900 to-cyan-800'
    },
    {
      label: 'BUSINESS STRATEGY',
      toolType: 'business-strategy',
      icon: <Briefcase className="h-4 w-4" />,
      gradient: 'from-amber-900 to-amber-800'
    },
    {
      label: 'EMAIL WRITER',
      toolType: 'email-executive',
      icon: <Mail className="h-4 w-4" />,
      gradient: 'from-indigo-900 to-indigo-800'
    }
  ];

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      const newScrollPosition = scrollContainerRef.current.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount);
      scrollContainerRef.current.scrollTo({
        left: newScrollPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleButtonClick = (tool: ToolButton) => {
    if (tool.toolType === 'devotional') {
      router.push('/devotional');
    } else {
      onToolSelect(tool.toolType as ToolType);
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto px-8">
      {/* Left Arrow */}
      <button
        onClick={() => scroll('left')}
        disabled={isLoading}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 disabled:opacity-50 transition-all hover:scale-110"
        aria-label="Scroll left"
      >
        <ChevronLeft className="h-5 w-5 text-slate-700" />
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide flex gap-3 py-2 px-4 scroll-smooth"
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

      {/* Right Arrow */}
      <button
        onClick={() => scroll('right')}
        disabled={isLoading}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-2 disabled:opacity-50 transition-all hover:scale-110"
        aria-label="Scroll right"
      >
        <ChevronRight className="h-5 w-5 text-slate-700" />
      </button>

      {/* Hide scrollbar CSS */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
