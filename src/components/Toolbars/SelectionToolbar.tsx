import React, { useState } from 'react';
import { Edit2, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, Trash2, Square, Circle } from 'lucide-react';
import { CanvasObject, Transform } from '../../types/canvas';

interface SelectionToolbarProps {
  selectedObject: CanvasObject;
  transform: Transform;
  isDarkMode: boolean;
  editingObjectId: string | null;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDelete: (id: string) => void;
  onEditStart: (id: string) => void;
  onApplyTextFormat: (e: React.MouseEvent, command: string, value?: string) => void;
}

export const SelectionToolbar = ({
  selectedObject,
  transform,
  isDarkMode,
  editingObjectId,
  onUpdate,
  onDelete,
  onEditStart,
  onApplyTextFormat
}: SelectionToolbarProps) => {
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBlockColorPicker, setShowBlockColorPicker] = useState(false);

  const COLORS = ['#ffffff', '#171717', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  const getToolbarStyle = (obj: CanvasObject) => {
    const screenX = (obj.x + obj.width / 2) * transform.scale + transform.x;
    const screenY = obj.y * transform.scale + transform.y;
    return {
      left: `${screenX}px`,
      top: `${screenY - 20}px`,
      transform: 'translate(-50%, -100%)',
      zIndex: 50
    };
  };

  if (selectedObject.type === 'text') {
    return (
      <div 
        className={`absolute pointer-events-auto flex items-center gap-2 p-2 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}
        style={getToolbarStyle(selectedObject)}
      >
        {/* Edit Button */}
        <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
          <button
            onClick={() => onEditStart(selectedObject.id)}
            className={`p-1.5 rounded-lg ${editingObjectId === selectedObject.id ? 'bg-blue-500 text-white' : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}
            title="Редактировать текст"
          >
            <Edit2 size={18} />
          </button>
        </div>

        {/* Rich Text Formatting (only active when editing) */}
        <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'} ${editingObjectId !== selectedObject.id ? 'opacity-50 pointer-events-none' : ''}`}>
          <button onMouseDown={(e) => onApplyTextFormat(e, 'bold')} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}><Bold size={18} /></button>
          <button onMouseDown={(e) => onApplyTextFormat(e, 'italic')} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}><Italic size={18} /></button>
          <button onMouseDown={(e) => onApplyTextFormat(e, 'underline')} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}><Underline size={18} /></button>
          
          {/* Inline Color Picker */}
          <div className="relative ml-1 flex items-center">
            <button
              onMouseDown={(e) => { e.preventDefault(); setShowTextColorPicker(!showTextColorPicker); setShowBlockColorPicker(false); }}
              className={`w-6 h-6 rounded-full border-2 ${isDarkMode ? 'border-neutral-600' : 'border-neutral-300'}`}
              style={{ background: 'linear-gradient(45deg, #ef4444, #3b82f6, #22c55e)' }}
              title="Цвет выделенного текста"
            />
            {showTextColorPicker && (
              <div className={`absolute top-full mt-2 left-0 p-2 rounded-xl shadow-xl backdrop-blur-md border flex gap-1 z-50 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}>
                {COLORS.map(c => (
                  <button
                    key={c}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onApplyTextFormat(e, 'foreColor', c);
                      setShowTextColorPicker(false);
                    }}
                    className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Block Formatting */}
        <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
          <button onClick={() => onUpdate(selectedObject.id, { fontSize: Math.max(8, (selectedObject.fontSize || 16) - 2) })} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}>-</button>
          <span className={`w-8 text-center text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>{selectedObject.fontSize || 16}</span>
          <button onClick={() => onUpdate(selectedObject.id, { fontSize: Math.min(120, (selectedObject.fontSize || 16) + 2) })} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}>+</button>
        </div>
        
        <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
          <button onClick={() => onUpdate(selectedObject.id, { textAlign: 'left' })} className={`p-1.5 rounded-lg ${selectedObject.textAlign === 'left' ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100/50 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}><AlignLeft size={18} /></button>
          <button onClick={() => onUpdate(selectedObject.id, { textAlign: 'center' })} className={`p-1.5 rounded-lg ${selectedObject.textAlign === 'center' ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100/50 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}><AlignCenter size={18} /></button>
          <button onClick={() => onUpdate(selectedObject.id, { textAlign: 'right' })} className={`p-1.5 rounded-lg ${selectedObject.textAlign === 'right' ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100/50 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}><AlignRight size={18} /></button>
        </div>

        {/* Block Color Picker */}
        <div className={`flex items-center px-2 border-r relative ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
          <button
            onClick={() => { setShowBlockColorPicker(!showBlockColorPicker); setShowTextColorPicker(false); }}
            className="w-6 h-6 rounded-full border-2 border-neutral-300 dark:border-neutral-600"
            style={{ backgroundColor: selectedObject.color || (isDarkMode ? '#ffffff' : '#000000') }}
            title="Цвет всего блока"
          />
          {showBlockColorPicker && (
            <div className={`absolute top-full mt-2 left-0 p-2 rounded-xl shadow-xl backdrop-blur-md border flex gap-1 z-50 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}>
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    onUpdate(selectedObject.id, { color: c });
                    setShowBlockColorPicker(false);
                  }}
                  className="w-6 h-6 rounded-full border border-neutral-200 dark:border-neutral-700 hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Delete Button */}
        <div className="flex items-center px-2">
          <button
            onClick={() => onDelete(selectedObject.id)}
            className={`p-1.5 rounded-lg text-red-500 ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-100'}`}
            title="Удалить"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (selectedObject.type === 'image') {
    return (
      <div 
        className={`absolute pointer-events-auto flex items-center gap-2 p-2 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}
        style={getToolbarStyle(selectedObject)}
      >
        <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
          <button
            onClick={() => onUpdate(selectedObject.id, { borderRadius: 0 })}
            className={`p-1.5 rounded-lg ${selectedObject.borderRadius === 0 || !selectedObject.borderRadius ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-700')}`}
            title="Прямые углы"
          >
            <Square size={18} />
          </button>
          <button
            onClick={() => onUpdate(selectedObject.id, { borderRadius: 16 })}
            className={`p-1.5 rounded-lg ${selectedObject.borderRadius === 16 ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-700')}`}
            title="Скругленные углы"
          >
            <div className="w-[18px] h-[18px] border-2 border-current rounded-md" />
          </button>
          <button
            onClick={() => onUpdate(selectedObject.id, { borderRadius: 9999 })}
            className={`p-1.5 rounded-lg ${selectedObject.borderRadius === 9999 ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-700')}`}
            title="Круг"
          >
            <Circle size={18} />
          </button>
        </div>

        {/* Delete Button */}
        <div className="flex items-center px-2">
          <button
            onClick={() => onDelete(selectedObject.id)}
            className={`p-1.5 rounded-lg text-red-500 ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-100'}`}
            title="Удалить"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  }

  if (selectedObject.type === 'question') {
    return (
      <div 
        className={`absolute pointer-events-auto flex items-center gap-2 p-2 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}
        style={getToolbarStyle(selectedObject)}
      >
        {/* Delete Button */}
        <div className="flex items-center px-2">
          <button
            onClick={() => onDelete(selectedObject.id)}
            className={`p-1.5 rounded-lg text-red-500 ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-100'}`}
            title="Удалить"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
