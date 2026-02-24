import React from 'react';
import { MousePointer2, Type } from 'lucide-react';

interface MainToolbarProps {
  activeTool: 'select' | 'text';
  isDarkMode: boolean;
  onToolChange: (tool: 'select' | 'text') => void;
}

export const MainToolbar = ({ activeTool, isDarkMode, onToolChange }: MainToolbarProps) => {
  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
      <div className={`flex flex-col gap-1.5 p-1.5 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/50 border-white/10' : 'bg-white/50 border-white/40'}`}>
        <button
          onClick={() => onToolChange('select')}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            activeTool === 'select'
              ? (isDarkMode ? 'bg-neutral-700/80 text-blue-400' : 'bg-white/80 text-blue-600 shadow-sm')
              : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-white/50 hover:text-neutral-900')
          }`}
          title="Выделение"
        >
          <MousePointer2 size={20} />
        </button>
        <button
          onClick={() => onToolChange('text')}
          className={`p-2.5 rounded-xl transition-all duration-200 ${
            activeTool === 'text'
              ? (isDarkMode ? 'bg-neutral-700/80 text-blue-400' : 'bg-white/80 text-blue-600 shadow-sm')
              : (isDarkMode ? 'text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-200' : 'text-neutral-600 hover:bg-white/50 hover:text-neutral-900')
          }`}
          title="Текст"
        >
          <Type size={20} />
        </button>
      </div>
    </div>
  );
};
