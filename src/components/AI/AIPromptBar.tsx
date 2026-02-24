import React, { useRef } from 'react';
import { Plus, Loader2, Sparkles } from 'lucide-react';

interface AIPromptBarProps {
  prompt: string;
  isLoading: boolean;
  aiStatus: string | null;
  isDarkMode: boolean;
  onPromptChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const AIPromptBar = ({
  prompt,
  isLoading,
  aiStatus,
  isDarkMode,
  onPromptChange,
  onSubmit,
  onImageUpload
}: AIPromptBarProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    onImageUpload(e);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 w-[40%] min-w-[320px] max-w-[600px] pointer-events-auto">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          className="hidden" 
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className={`w-[52px] h-[52px] shrink-0 rounded-2xl border flex items-center justify-center shadow-lg backdrop-blur-md transition-all hover:scale-105 active:scale-95 ${
            isDarkMode 
              ? 'bg-neutral-900/50 border-white/10 text-white hover:bg-neutral-800/60' 
              : 'bg-white/50 border-white/40 text-black hover:bg-white/70'
          }`}
          title="Добавить картинку"
        >
          <Plus size={24} />
        </button>

        <form onSubmit={onSubmit} className="flex-1 relative flex items-center">
          <input
            type="text"
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Попросите ИИ что-нибудь сделать..."
            className={`w-full pl-5 pr-12 py-3.5 rounded-2xl shadow-lg backdrop-blur-md border outline-none transition-all ${
              isDarkMode 
                ? 'bg-neutral-900/50 border-white/10 text-white placeholder:text-neutral-400 focus:border-blue-500/50' 
                : 'bg-white/50 border-white/40 text-neutral-900 placeholder:text-neutral-500 focus:border-blue-500/50'
            }`}
          />
          <button
            type="submit"
            className={`absolute right-2 p-2 rounded-xl transition-colors ${
              prompt.trim() && !isLoading
                ? 'bg-blue-500 text-white hover:bg-blue-600' 
                : 'bg-transparent text-neutral-400'
            }`}
            disabled={!prompt.trim() || isLoading}
          >
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
        </form>
      </div>
      
      {/* AI Status Overlay */}
      <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 transition-all duration-300 pointer-events-none ${
        isLoading && aiStatus ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}>
        <div className={`px-4 py-2 rounded-full shadow-lg backdrop-blur-md border flex items-center gap-3 ${
          isDarkMode ? 'bg-neutral-900/60 text-neutral-200 border-white/10' : 'bg-white/60 text-neutral-800 border-white/40'
        }`}>
          <Loader2 size={16} className="animate-spin text-blue-500" />
          <span className="text-sm font-medium">{aiStatus}</span>
        </div>
      </div>
    </>
  );
};
