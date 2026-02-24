import React, { useState, useEffect } from 'react';
import { Moon, Sun, Plus, Clock, FileText } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface Project {
  id: string;
  name: string;
  date: number;
  canvasJSON: string;
}

interface StartMenuProps {
  onNewCanvas: () => void;
  onOpenProject: (project: Project) => void;
}

export const StartMenu: React.FC<StartMenuProps> = ({ onNewCanvas, onOpenProject }) => {
  const { theme, toggleTheme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    const savedProjects = localStorage.getItem('mindcanvas_projects');
    if (savedProjects) {
      try {
        setProjects(JSON.parse(savedProjects).sort((a: Project, b: Project) => b.date - a.date));
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Last opened today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Last opened yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return `Last opened ${date.toLocaleDateString()}`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-theme-bg/90 backdrop-blur-sm">
      {/* Background dot grid */}
      <div className="absolute inset-0 bg-dot-grid opacity-50 pointer-events-none" />

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-6 right-6 p-3 rounded-full bg-theme-panel text-theme-text shadow-sm border border-theme-text-secondary/20 hover:scale-105 active:scale-95 transition-all"
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      <div className="relative z-10 w-full max-w-2xl p-8 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold tracking-tight text-theme-text mb-3">MindCanvas</h1>
          <p className="text-xl text-theme-text-secondary font-medium">AI Thinking Space</p>
        </div>

        {/* New Canvas Button */}
        <button
          onClick={onNewCanvas}
          className="w-full max-w-md py-4 px-6 mb-12 flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 active:translate-y-0"
        >
          <Plus size={24} />
          New Canvas
        </button>

        {/* Recent Projects */}
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-4 text-theme-text-secondary">
            <Clock size={18} />
            <h2 className="text-sm font-semibold uppercase tracking-wider">Recent Projects</h2>
          </div>

          {projects.length === 0 ? (
            <div className="text-center py-8 text-theme-text-secondary bg-theme-panel rounded-2xl border border-theme-text-secondary/10">
              <p>No recent projects</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => onOpenProject(project)}
                  className="flex items-start gap-4 p-4 text-left bg-theme-panel hover:bg-theme-text-secondary/10 rounded-2xl border border-theme-text-secondary/10 transition-colors group"
                >
                  <div className="p-3 bg-theme-bg rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
                    <FileText size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-theme-text font-medium truncate mb-1">{project.name}</h3>
                    <p className="text-xs text-theme-text-secondary truncate">{formatDate(project.date)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
