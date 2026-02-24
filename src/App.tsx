/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Moon, Sun, Download, Upload } from 'lucide-react';
import { useQuestionBlock } from './hooks/useQuestionBlock';
import { createQuestionBlock } from './utils/questionBlockHelpers';
import { StartMenu } from './components/StartMenu';
import { useTheme } from './contexts/ThemeContext';
import { useCanvas } from './hooks/useCanvas';
import { useAI } from './hooks/useAI';
import { CanvasLayer } from './components/Canvas/CanvasLayer';
import { SelectionToolbar } from './components/Toolbars/SelectionToolbar';
import { MainToolbar } from './components/Toolbars/MainToolbar';
import { AIPromptBar } from './components/AI/AIPromptBar';
import { CanvasObject } from './types/canvas';

// Extend Window interface for our future AI API
declare global {
  interface Window {
    canvasAPI: any;
  }
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showInstruction, setShowInstruction] = useState(true);

  const {
    objects,
    setObjects,
    activeTool,
    setActiveTool,
    transform,
    setTransform,
    selectionBox,
    isSelecting,
    editingObjectId,
    setEditingObjectId,
    showTextColorPicker,
    showBlockColorPicker,
    containerRef,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleImageUpload,
    applyTextFormat,
    updateSelectedText,
    updateSelectedImage,
    handleObjectPointerDown,
    handleObjectResizeStart
  } = useCanvas();
  
  const { userProfile, handleAnswerQuestion, handleSkipQuestion, addConfidenceToHistory } = useQuestionBlock(objects, setObjects);

  const {
    prompt,
    setPrompt,
    isLoading,
    aiStatus,
    handlePromptSubmit
  } = useAI({
    objects,
    setObjects,
    userProfile,
    addConfidenceToHistory,
    createQuestionBlock
  });

  // Auto-hide instruction
  useEffect(() => {
    const t = setTimeout(() => setShowInstruction(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Expose API for future AI integration
  useEffect(() => {
    window.canvasAPI = {
      getObjects: () => objects,
      setObjects: (newObjects: CanvasObject[]) => setObjects(newObjects),
      clear: () => setObjects([]),
      exportJSON: () => JSON.stringify(objects, null, 2),
      importJSON: (json: string) => {
        try { setObjects(JSON.parse(json)); } 
        catch (e) { console.error("Invalid JSON", e); }
      }
    };
  }, [objects, setObjects]);

  // Save current project to localStorage
  useEffect(() => {
    if (isMenuOpen || !currentProjectId) return;

    const savedProjects = localStorage.getItem('mindcanvas_projects');
    let projects = [];
    if (savedProjects) {
      try {
        projects = JSON.parse(savedProjects);
      } catch (e) {
        console.error("Failed to parse projects", e);
      }
    }

    const existingProjectIndex = projects.findIndex((p: any) => p.id === currentProjectId);
    const projectData = {
      id: currentProjectId,
      name: `Project ${new Date().toLocaleDateString()}`, // Simple naming for now
      date: Date.now(),
      canvasJSON: JSON.stringify(objects)
    };

    if (existingProjectIndex >= 0) {
      // Keep existing name if it was set
      projectData.name = projects[existingProjectIndex].name;
      projects[existingProjectIndex] = projectData;
    } else {
      projects.push(projectData);
    }

    localStorage.setItem('mindcanvas_projects', JSON.stringify(projects));
  }, [objects, currentProjectId, isMenuOpen]);

  const handleNewCanvas = () => {
    setObjects([]);
    setCurrentProjectId(`proj-${Date.now()}`);
    setIsMenuOpen(false);
  };

  const handleOpenProject = (project: any) => {
    try {
      setObjects(JSON.parse(project.canvasJSON));
      setCurrentProjectId(project.id);
      setIsMenuOpen(false);
    } catch (e) {
      console.error("Failed to load project", e);
      alert("Failed to load project.");
    }
  };

  // Toggle dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleDownloadCanvas = () => {
    const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(objects));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "brainstorm_canvas.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleUploadCanvas = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) {
          setObjects(parsed);
        } else {
          alert("Неверный формат файла");
        }
      } catch (err) {
        console.error(err);
        alert("Ошибка при чтении файла");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const selectedObject = objects.find(obj => obj.isSelected);
  const fileInputLoadRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {isMenuOpen && (
        <StartMenu 
          onNewCanvas={handleNewCanvas} 
          onOpenProject={handleOpenProject} 
        />
      )}
      <div 
        ref={containerRef}
        className={`fixed inset-0 overflow-hidden touch-none transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}
      >
        <CanvasLayer
          objects={objects}
          transform={transform}
          isDarkMode={isDarkMode}
          activeTool={activeTool}
          editingObjectId={editingObjectId}
          selectionBox={selectionBox}
          isSelecting={isSelecting}
          onPointerDown={(e) => handleCanvasPointerDown(e, isDarkMode)}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onObjectPointerDown={handleObjectPointerDown}
          onObjectDoubleClick={(e, obj) => {
            if (obj.type === 'text' && activeTool === 'select') {
              e.stopPropagation();
              setEditingObjectId(obj.id);
            }
          }}
          onObjectResizeStart={handleObjectResizeStart}
          onContentChange={(id, content) => setObjects(prev => prev.map(o => o.id === id ? { ...o, content } : o))}
          onAnswerQuestion={handleAnswerQuestion}
          onSkipQuestion={handleSkipQuestion}
        />
      
        <div className="absolute top-4 left-4 right-4 text-center pointer-events-none flex justify-between items-start">
          <div className="flex-1" />
          <div className={`transition-opacity duration-1000 ${showInstruction ? 'opacity-100' : 'opacity-0'} inline-block px-4 py-2 rounded-full text-sm backdrop-blur-md shadow-lg border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/50 border-white/10 text-neutral-200' : 'bg-white/50 border-white/40 text-neutral-800'}`}>
            Используйте два пальца или колесико мыши для перемещения и масштабирования
          </div>
          <div className="flex-1 flex justify-end pointer-events-auto gap-2">
            <input 
              type="file" 
              accept="*/*" 
              className="hidden" 
              ref={fileInputLoadRef} 
              onChange={handleUploadCanvas} 
            />
            <button
              onClick={() => fileInputLoadRef.current?.click()}
              className={`p-3 rounded-full shadow-lg backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 ${
                isDarkMode 
                  ? 'bg-neutral-900/50 border-white/10 text-white hover:bg-neutral-800/60' 
                  : 'bg-white/50 border-white/40 text-neutral-700 hover:bg-white/70'
              }`}
              title="Загрузить холст"
            >
              <Upload size={24} />
              <span className="text-sm font-medium hidden sm:inline">Загрузить</span>
            </button>
            <button
              onClick={handleDownloadCanvas}
              className={`p-3 rounded-full shadow-lg backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 ${
                isDarkMode 
                  ? 'bg-neutral-900/50 border-white/10 text-white hover:bg-neutral-800/60' 
                  : 'bg-white/50 border-white/40 text-neutral-700 hover:bg-white/70'
              }`}
              title="Скачать холст"
            >
              <Download size={24} />
              <span className="text-sm font-medium hidden sm:inline">Скачать</span>
            </button>
            <button
              onClick={() => toggleTheme()}
              className={`p-3 rounded-full shadow-lg backdrop-blur-md border transition-all duration-300 hover:scale-105 active:scale-95 ${
                isDarkMode 
                  ? 'bg-neutral-900/50 border-white/10 text-white hover:bg-neutral-800/60' 
                  : 'bg-white/50 border-white/40 text-neutral-700 hover:bg-white/70'
              }`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
          </div>
        </div>

        {selectedObject && (
          <SelectionToolbar
            selectedObject={selectedObject}
            transform={transform}
            isDarkMode={isDarkMode}
            editingObjectId={editingObjectId}
            onUpdate={(id, updates) => setObjects(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))}
            onDelete={(id) => setObjects(prev => prev.filter(o => o.id !== id))}
            onEditStart={(id) => setEditingObjectId(id)}
            onApplyTextFormat={applyTextFormat}
          />
        )}

        <MainToolbar 
          activeTool={activeTool} 
          isDarkMode={isDarkMode} 
          onToolChange={setActiveTool} 
        />

        <AIPromptBar
          prompt={prompt}
          isLoading={isLoading}
          aiStatus={aiStatus}
          isDarkMode={isDarkMode}
          onPromptChange={setPrompt}
          onSubmit={handlePromptSubmit}
          onImageUpload={(e) => handleImageUpload(e, { current: null } as any)} // Hack: fileInputRef is handled inside AIPromptBar but we need to pass the handler. 
          // Actually, handleImageUpload in useCanvas expects a ref. We should probably refactor that or pass a dummy ref if not needed for reset here since AIPromptBar handles its own ref.
          // Let's check useCanvas handleImageUpload implementation. It uses the ref to clear the value.
          // We can pass a dummy ref here because AIPromptBar has its own ref and we might need to expose it or just let the handler run.
          // Better: update AIPromptBar to handle the file input ref internally and just call a simple onImageUpload function.
        />
      </div>
    </>
  );
}
