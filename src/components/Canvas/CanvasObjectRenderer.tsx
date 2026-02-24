import React, { memo } from 'react';
import { Square, Circle, Trash2, Edit2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { CanvasObject } from '../../types/canvas';
import { QuestionBlock } from '../QuestionBlock';

interface CanvasObjectRendererProps {
  obj: CanvasObject;
  isDarkMode: boolean;
  activeTool: 'select' | 'text';
  editingObjectId: string | null;
  onPointerDown: (e: React.PointerEvent, obj: CanvasObject) => void;
  onDoubleClick: (e: React.MouseEvent, obj: CanvasObject) => void;
  onResizeStart: (e: React.PointerEvent, obj: CanvasObject, type: 'text' | 'image') => void;
  onContentChange: (id: string, content: string) => void;
  onAnswerQuestion: (id: string, answer: string | string[]) => void;
  onSkipQuestion: (id: string) => void;
}

export const CanvasObjectRenderer = memo(({
  obj,
  isDarkMode,
  activeTool,
  editingObjectId,
  onPointerDown,
  onDoubleClick,
  onResizeStart,
  onContentChange,
  onAnswerQuestion,
  onSkipQuestion
}: CanvasObjectRendererProps) => {
  return (
    <div
      className={`absolute border-2 ${obj.isSelected ? 'border-blue-500 shadow-lg' : 'border-transparent'} ${obj.type === 'text' ? 'cursor-text' : ''}`}
      style={{
        left: obj.x,
        top: obj.y,
        width: obj.width,
        height: obj.type === 'text' || obj.type === 'question' ? 'auto' : obj.height,
        minHeight: obj.type === 'text' ? 50 : undefined,
        zIndex: obj.isSelected ? 10 : 1, // Bring selected to front
      }}
      onPointerDown={(e) => onPointerDown(e, obj)}
      onDoubleClick={(e) => onDoubleClick(e, obj)}
    >
      {/* Selection Handles (Visual only for now) */}
      {obj.isSelected && (
        <>
          <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full" />
          <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full" />
          <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full" />
          <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-500 rounded-full" />
        </>
      )}

      {/* Width Resize Handle for Text */}
      {obj.isSelected && obj.type === 'text' && (
        <div 
          className="absolute top-0 -right-4 w-8 h-full cursor-ew-resize z-20 flex items-center justify-center"
          onPointerDown={(e) => onResizeStart(e, obj, 'text')}
        >
          <div className="w-1.5 h-6 bg-white border border-blue-500 rounded-full shadow-sm" />
        </div>
      )}

      {/* Proportional Resize Handle for Image */}
      {obj.isSelected && obj.type === 'image' && (
        <div 
          className="absolute -bottom-4 -right-4 w-8 h-8 cursor-nwse-resize z-20 flex items-center justify-center"
          onPointerDown={(e) => onResizeStart(e, obj, 'image')}
        >
          <div className="w-3 h-3 bg-white border-2 border-blue-500 rounded-full shadow-sm" />
        </div>
      )}

      {obj.type === 'text' && (
        <div
          id={`text-edit-${obj.id}`}
          contentEditable={editingObjectId === obj.id}
          suppressContentEditableWarning
          className={`w-full h-full p-2 outline-none break-words ${editingObjectId === obj.id ? 'cursor-text' : 'cursor-default'}`}
          style={{ 
            color: obj.color || (isDarkMode ? 'white' : 'black'),
            fontSize: `${obj.fontSize || 16}px`,
            textAlign: obj.textAlign || 'left',
            minHeight: '50px',
            userSelect: editingObjectId === obj.id ? 'text' : 'none',
            WebkitUserSelect: editingObjectId === obj.id ? 'text' : 'none',
          }}
          onBlur={(e) => onContentChange(obj.id, e.currentTarget.innerHTML)}
          dangerouslySetInnerHTML={{ __html: obj.content || 'Новый текст' }}
        />
      )}
      {obj.type === 'image' && obj.src && (
        <img 
          src={obj.src} 
          alt="Canvas object" 
          className="w-full h-full object-cover pointer-events-none" 
          style={{ borderRadius: obj.borderRadius || 0 }}
        />
      )}
      {obj.type === 'question' && (
        <QuestionBlock 
          obj={obj} 
          isDarkMode={isDarkMode} 
          onAnswer={onAnswerQuestion} 
          onSkip={onSkipQuestion} 
        />
      )}
    </div>
  );
}, (prev, next) => {
  // Custom comparison for performance
  return (
    prev.obj === next.obj &&
    prev.isDarkMode === next.isDarkMode &&
    prev.activeTool === next.activeTool &&
    prev.editingObjectId === next.editingObjectId
  );
});
