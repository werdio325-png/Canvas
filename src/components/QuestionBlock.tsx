import React, { useState } from 'react';
import { HelpCircle, Check, X } from 'lucide-react';
import { CanvasObject } from '../types/canvas';

interface QuestionBlockProps {
  obj: CanvasObject;
  isDarkMode: boolean;
  onAnswer: (id: string, answer: string | string[]) => void;
  onSkip: (id: string) => void;
}

export function QuestionBlock({ obj, isDarkMode, onAnswer, onSkip }: QuestionBlockProps) {
  const [textAnswer, setTextAnswer] = useState('');
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const handleOptionClick = (option: string) => {
    if (obj.answerType === 'single') {
      setSelectedOptions([option]);
    } else if (obj.answerType === 'multiple') {
      setSelectedOptions(prev => 
        prev.includes(option) ? prev.filter(o => o !== option) : [...prev, option]
      );
    }
  };

  const handleSubmit = () => {
    if (obj.answerType === 'text') {
      if (textAnswer.trim()) {
        onAnswer(obj.id, textAnswer.trim());
      }
    } else {
      if (selectedOptions.length > 0) {
        onAnswer(obj.id, obj.answerType === 'single' ? selectedOptions[0] : selectedOptions);
      }
    }
  };

  if (obj.answered) {
    return (
      <div className={`w-full h-full p-4 flex flex-col gap-2 rounded-2xl border-2 ${isDarkMode ? 'bg-neutral-800/80 border-neutral-700 text-neutral-300' : 'bg-white/80 border-neutral-200 text-neutral-600'} backdrop-blur-md`}>
        <div className="flex items-center gap-2 font-medium opacity-70">
          <HelpCircle size={18} />
          <span>{obj.question}</span>
        </div>
        <div className="text-sm italic opacity-80">
          Ответ: {Array.isArray(obj.userAnswer) ? obj.userAnswer.join(', ') : obj.userAnswer}
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-auto min-h-full p-5 flex flex-col gap-4 rounded-2xl border shadow-xl backdrop-blur-md transition-all ${isDarkMode ? 'bg-[#1a1a1a]/90 border-blue-500/30 text-white' : 'bg-white/90 border-blue-400/30 text-neutral-900'}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-[#2a3a5a] text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
          <HelpCircle size={24} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg leading-tight">{obj.question}</h3>
          {obj.explanation && (
            <p className={`text-sm mt-2 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {obj.explanation}
            </p>
          )}
        </div>
      </div>

      <div className="flex-1 mt-2">
        {obj.answerType === 'text' ? (
          <textarea
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Попросите ИИ что-нибудь сделать..."
            className={`w-full min-h-[100px] p-4 rounded-2xl resize-none outline-none transition-colors border ${isDarkMode ? 'bg-[#141414] border-neutral-800 focus:border-blue-500/50 text-neutral-200 placeholder:text-neutral-600' : 'bg-neutral-50 border-neutral-200 focus:border-blue-500/50 text-neutral-800 placeholder:text-neutral-400'}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {obj.options?.map((option, idx) => {
              const isSelected = selectedOptions.includes(option);
              return (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                    isSelected 
                      ? (isDarkMode ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-blue-50 border-blue-500/50 text-blue-700')
                      : (isDarkMode ? 'bg-[#141414] border-neutral-800 hover:border-neutral-600 text-neutral-300' : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300 text-neutral-700')
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-500 text-white' 
                      : (isDarkMode ? 'border-neutral-700' : 'border-neutral-400')
                  }`}>
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span className="text-sm">{option}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pt-4 mt-2 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={handleSubmit}
          disabled={obj.answerType === 'text' ? !textAnswer.trim() : selectedOptions.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1e40af] hover:bg-[#1e3a8a] text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check size={18} />
          Ответить
        </button>
        <button
          onClick={() => onSkip(obj.id)}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-colors ${isDarkMode ? 'bg-[#262626] hover:bg-[#333333] text-neutral-300' : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-600'}`}
        >
          <X size={18} />
          Пропустить
        </button>
      </div>
    </div>
  );
}
