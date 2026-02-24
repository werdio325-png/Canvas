import React, { memo } from 'react';
import { CanvasObject, Transform } from '../../types/canvas';
import { CanvasObjectRenderer } from './CanvasObjectRenderer';

interface CanvasLayerProps {
  objects: CanvasObject[];
  transform: Transform;
  isDarkMode: boolean;
  activeTool: 'select' | 'text';
  editingObjectId: string | null;
  selectionBox: { startX: number, startY: number, endX: number, endY: number } | null;
  isSelecting: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onObjectPointerDown: (e: React.PointerEvent, obj: CanvasObject) => void;
  onObjectDoubleClick: (e: React.MouseEvent, obj: CanvasObject) => void;
  onObjectResizeStart: (e: React.PointerEvent, obj: CanvasObject, type: 'text' | 'image') => void;
  onContentChange: (id: string, content: string) => void;
  onAnswerQuestion: (id: string, answer: string | string[]) => void;
  onSkipQuestion: (id: string) => void;
}

export const CanvasLayer = memo(({
  objects,
  transform,
  isDarkMode,
  activeTool,
  editingObjectId,
  selectionBox,
  isSelecting,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onObjectPointerDown,
  onObjectDoubleClick,
  onObjectResizeStart,
  onContentChange,
  onAnswerQuestion,
  onSkipQuestion
}: CanvasLayerProps) => {
  return (
    <div 
      className="absolute origin-top-left will-change-transform"
      style={{
        transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        width: 2400,
        height: 1800,
      }}
    >
      <div 
        className={`w-full h-full shadow-2xl border transition-colors duration-300 relative ${isDarkMode ? 'bg-neutral-950 border-neutral-800' : 'bg-white border-neutral-200'}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
      >
        <canvas
          width={2400}
          height={1800}
          className="bg-dot-grid block w-full h-full absolute inset-0 pointer-events-none"
        />
        
        {/* Render Selection Box */}
        {isSelecting && selectionBox && (
          <div
            className="absolute border border-blue-500 bg-blue-500/10 pointer-events-none"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.endX),
              top: Math.min(selectionBox.startY, selectionBox.endY),
              width: Math.abs(selectionBox.endX - selectionBox.startX),
              height: Math.abs(selectionBox.endY - selectionBox.startY),
            }}
          />
        )}

        {/* Render Canvas Objects */}
        {objects.map(obj => (
          <CanvasObjectRenderer
            key={obj.id}
            obj={obj}
            isDarkMode={isDarkMode}
            activeTool={activeTool}
            editingObjectId={editingObjectId}
            onPointerDown={onObjectPointerDown}
            onDoubleClick={onObjectDoubleClick}
            onResizeStart={onObjectResizeStart}
            onContentChange={onContentChange}
            onAnswerQuestion={onAnswerQuestion}
            onSkipQuestion={onSkipQuestion}
          />
        ))}
      </div>
    </div>
  );
});
