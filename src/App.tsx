/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Moon, Sun, MousePointer2, Type, Plus, Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Square, Circle, Edit2, Bold, Italic, Underline, Trash2, Sparkles, Loader2, Download, Upload } from 'lucide-react';
import { GoogleGenAI, Type as GenAIType, FunctionDeclaration } from '@google/genai';

export type CanvasObjectType = 'text' | 'image';

export interface CanvasObject {
  id: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  content?: string;
  src?: string;
  isSelected?: boolean;
  fontSize?: number;
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  borderRadius?: number;
}


interface PointerMoveSnapshot {
  clientX: number;
  clientY: number;
  movementX: number;
  movementY: number;
  target: HTMLDivElement;
}

// Extend Window interface for our future AI API
declare global {
  interface Window {
    canvasAPI: any;
  }
}

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'text'>('select');
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  
  // Selection and Dragging state
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragContext, setDragContext] = useState<{ startX: number, startY: number, initialPositions: Record<string, {x: number, y: number}> } | null>(null);
  const [resizingObject, setResizingObject] = useState<{ id: string, startX: number, startY: number, startWidth: number, startHeight: number, type: 'text' | 'image' } | null>(null);
  const isPinchingRef = useRef(false);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const isPanningRef = useRef(false);
  const interactionRectRef = useRef<DOMRect | null>(null);
  const latestPointerEventRef = useRef<PointerMoveSnapshot | null>(null);
  const moveFrameRef = useRef<number | null>(null);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBlockColorPicker, setShowBlockColorPicker] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const chatRef = useRef<any>(null);
  const sentImagesRef = useRef<Set<string>>(new Set());
  const fileInputLoadRef = useRef<HTMLInputElement>(null);

  const COLORS = ['#ffffff', '#171717', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

  const clearSelection = (items: CanvasObject[]) => {
    let changed = false;
    const nextItems = items.map((obj) => {
      if (!obj.isSelected) return obj;
      changed = true;
      return { ...obj, isSelected: false };
    });

    return changed ? nextItems : items;
  };

  // Initialize AI Chat
  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const modifyCanvasDeclaration: FunctionDeclaration = {
      name: "modifyCanvas",
      description: "Modifies the canvas by adding, updating, or deleting text objects.",
      parameters: {
        type: GenAIType.OBJECT,
        properties: {
          add: {
            type: GenAIType.ARRAY,
            description: "List of new objects to add to the canvas.",
            items: {
              type: GenAIType.OBJECT,
              properties: {
                type: { type: GenAIType.STRING, description: "'text' or 'image'" },
                x: { type: GenAIType.NUMBER },
                y: { type: GenAIType.NUMBER },
                width: { type: GenAIType.NUMBER },
                height: { type: GenAIType.NUMBER },
                content: { type: GenAIType.STRING, description: "Text content (HTML allowed)" },
                color: { type: GenAIType.STRING, description: "Hex color code" },
                fontSize: { type: GenAIType.NUMBER },
                textAlign: { type: GenAIType.STRING, description: "'left', 'center', or 'right'" }
              },
              required: ["type", "x", "y", "width", "height"]
            }
          },
          update: {
            type: GenAIType.ARRAY,
            description: "List of objects to update.",
            items: {
              type: GenAIType.OBJECT,
              properties: {
                id: { type: GenAIType.STRING },
                x: { type: GenAIType.NUMBER },
                y: { type: GenAIType.NUMBER },
                width: { type: GenAIType.NUMBER },
                height: { type: GenAIType.NUMBER },
                content: { type: GenAIType.STRING },
                color: { type: GenAIType.STRING },
                fontSize: { type: GenAIType.NUMBER },
                textAlign: { type: GenAIType.STRING }
              },
              required: ["id"]
            }
          },
          delete: {
            type: GenAIType.ARRAY,
            description: "List of object IDs to delete.",
            items: {
              type: GenAIType.STRING
            }
          }
        }
      }
    };

    const generateImageDeclaration: FunctionDeclaration = {
      name: "generateImage",
      description: "Generates a new image based on a text prompt and adds it to the canvas. Use this when the user asks to draw, create, or generate an image.",
      parameters: {
        type: GenAIType.OBJECT,
        properties: {
          prompt: {
            type: GenAIType.STRING,
            description: "A highly detailed prompt for the image generation model. Include style, subject, lighting, etc. based on the user's request and canvas context."
          }
        },
        required: ["prompt"]
      }
    };

    const editImageDeclaration: FunctionDeclaration = {
      name: "editImage",
      description: "Edits existing images on the canvas based on a text prompt. Creates a new image as a result. Use this when the user asks to change, modify, or edit specific images.",
      parameters: {
        type: GenAIType.OBJECT,
        properties: {
          prompt: {
            type: GenAIType.STRING,
            description: "A detailed prompt describing how to edit the images."
          },
          imageIds: {
            type: GenAIType.ARRAY,
            items: { type: GenAIType.STRING },
            description: "List of image IDs from the canvas to be used as reference/source for the edit."
          }
        },
        required: ["prompt", "imageIds"]
      }
    };

    chatRef.current = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `You are a canvas layout AI for brainstorming.
Canvas size: 2400x1800. Center: (1200, 900).
Rules:
1. MAXIMALLY COMPACT: Group all generated objects as tightly as possible in the center of the canvas. Do not spread them out.
2. STRICTLY NO OVERLAP: Calculate the bounding boxes (x, y, width, height) of all existing and new objects. Ensure NO objects overlap. Leave a small gap (e.g., 10-20px) between them.
3. Layout items logically in a dense grid, list, or mind-map structure around the center.
4. Use reasonable defaults for text (width: 200, height: 60, fontSize: 20).
5. You can modify the canvas (modifyCanvas), generate new images (generateImage), or edit existing images (editImage). Output the appropriate tool call based on the user's request.`,
        tools: [{ functionDeclarations: [modifyCanvasDeclaration, generateImageDeclaration, editImageDeclaration] }],
        temperature: 0.1,
      }
    });
  }, []);

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
  }, [objects]);

  // Keyboard shortcuts removed as requested

  // Toggle dark mode class on document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Center the canvas initially
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTransform({
        x: (rect.width - 2400) / 2,
        y: (rect.height - 1800) / 2,
        scale: 1
      });
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let initialDistance = 0;
    let lastMidpoint = { x: 0, y: 0 };
    let isPinching = false;

    const getDistance = (touches: TouchList) => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const getMidpoint = (touches: TouchList) => {
      return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2,
      };
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        isPinching = true;
        isPinchingRef.current = true;
        initialDistance = getDistance(e.touches);
        lastMidpoint = getMidpoint(e.touches);
      } else {
        isPinching = false;
        isPinchingRef.current = false;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && isPinching) {
        e.preventDefault();
        
        const currentDistance = getDistance(e.touches);
        const currentMidpoint = getMidpoint(e.touches);
        
        if (initialDistance === 0) initialDistance = 1;
        
        const scaleChange = currentDistance / initialDistance;
        const dx = currentMidpoint.x - lastMidpoint.x;
        const dy = currentMidpoint.y - lastMidpoint.y;

        setTransform(prev => {
          let newScale = prev.scale * scaleChange;
          newScale = Math.max(0.1, Math.min(newScale, 5));
          
          const scaleRatio = newScale / prev.scale;
          const newX = currentMidpoint.x - (currentMidpoint.x - (prev.x + dx)) * scaleRatio;
          const newY = currentMidpoint.y - (currentMidpoint.y - (prev.y + dy)) * scaleRatio;

          return { x: newX, y: newY, scale: newScale };
        });

        initialDistance = currentDistance;
        lastMidpoint = currentMidpoint;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
        isPinchingRef.current = false;
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      // Zoom on wheel scroll
      const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
      
      setTransform(prev => {
        let newScale = prev.scale * scaleChange;
        newScale = Math.max(0.1, Math.min(newScale, 5));
        
        const scaleRatio = newScale / prev.scale;
        const newX = e.clientX - (e.clientX - prev.x) * scaleRatio;
        const newY = e.clientY - (e.clientY - prev.y) * scaleRatio;
        
        return { x: newX, y: newY, scale: newScale };
      });
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    isPanningRef.current = isPanning;
  }, [isPanning]);

  // Mouse event handlers for the canvas (for tools)
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (showTextColorPicker) setShowTextColorPicker(false);
    if (showBlockColorPicker) setShowBlockColorPicker(false);

    if (isPinchingRef.current) return;

    // Middle mouse button for panning
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    // Only handle left clicks for tools
    if (e.button !== 0 || (e.pointerType === 'touch' && !e.isPrimary)) return;

    if (editingObjectId) {
      setEditingObjectId(null);
    }

    const rect = e.currentTarget.getBoundingClientRect();
    interactionRectRef.current = rect;
    // Calculate coordinates relative to the unscaled canvas
    const x = (e.clientX - rect.left) / transform.scale;
    const y = (e.clientY - rect.top) / transform.scale;

    if (activeTool === 'select') {
      setIsSelecting(true);
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      
      // Deselect all objects if clicking on empty space
      setObjects(prev => clearSelection(prev));
    } else if (activeTool === 'text') {
      const newText: CanvasObject = {
        id: `text-${Date.now()}`,
        type: 'text',
        x,
        y,
        width: 250,
        height: 100,
        content: 'Новый текст',
        isSelected: true,
        fontSize: 16,
        color: isDarkMode ? '#ffffff' : '#000000',
        textAlign: 'left'
      };
      setObjects(prev => [...clearSelection(prev), newText]);
      setActiveTool('select'); // Switch back to select tool after creating
    }
  };

  const processPointerMove = useCallback((e: PointerMoveSnapshot) => {
    if (isPinchingRef.current) return;

    if (isPanningRef.current) {
      if (e.movementX === 0 && e.movementY === 0) return;
      setTransform(prev => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
      return;
    }

    const rect = interactionRectRef.current ?? e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / transform.scale;
    const y = (e.clientY - rect.top) / transform.scale;

    // Handle object resizing
    if (resizingObject) {
      const dx = (e.clientX - resizingObject.startX) / transform.scale;
      const dy = (e.clientY - resizingObject.startY) / transform.scale;

      setObjects(prev => prev.map(obj => {
        if (obj.id === resizingObject.id) {
          if (resizingObject.type === 'text') {
            return { ...obj, width: Math.max(100, resizingObject.startWidth + dx) };
          } else if (resizingObject.type === 'image') {
            const ratio = resizingObject.startWidth / resizingObject.startHeight;
            const newWidth = Math.max(50, resizingObject.startWidth + dx);
            return { ...obj, width: newWidth, height: newWidth / ratio };
          }
        }
        return obj;
      }));
      return;
    }

    // Handle object dragging
    if (dragContext && activeTool === 'select') {
      const dx = x - dragContext.startX;
      const dy = y - dragContext.startY;
      if (dx === 0 && dy === 0) return;
      setObjects(prev => prev.map(obj =>
        dragContext.initialPositions[obj.id]
          ? { ...obj, x: dragContext.initialPositions[obj.id].x + dx, y: dragContext.initialPositions[obj.id].y + dy }
          : obj
      ));
      return;
    }

    // Handle selection box
    if (!isSelecting || !selectionBox || activeTool !== 'select') return;

    setSelectionBox(prev => prev ? { ...prev, endX: x, endY: y } : null);

    // Select objects within the box
    if (objects.length === 0) return;
    const minX = Math.min(selectionBox.startX, x);
    const maxX = Math.max(selectionBox.startX, x);
    const minY = Math.min(selectionBox.startY, y);
    const maxY = Math.max(selectionBox.startY, y);

    setObjects(prev => {
      let changed = false;
      const next = prev.map(obj => {
        const isInside =
          obj.x < maxX && obj.x + obj.width > minX &&
          obj.y < maxY && obj.y + obj.height > minY;

        if (obj.isSelected === isInside) return obj;
        changed = true;
        return { ...obj, isSelected: isInside };
      });

      return changed ? next : prev;
    });
  }, [activeTool, dragContext, isSelecting, objects.length, resizingObject, selectionBox, transform.scale]);

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    latestPointerEventRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      movementX: e.movementX,
      movementY: e.movementY,
      target: e.currentTarget,
    };

    if (moveFrameRef.current !== null) return;

    moveFrameRef.current = window.requestAnimationFrame(() => {
      const latest = latestPointerEventRef.current;
      moveFrameRef.current = null;
      if (!latest) return;
      processPointerMove(latest);
    });
  };


  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (isSelecting) {
      setIsSelecting(false);
      setSelectionBox(null);
    }
    if (dragContext) {
      setDragContext(null);
    }
    if (resizingObject) {
      setResizingObject(null);
    }
    interactionRectRef.current = null;
    latestPointerEventRef.current = null;
    if (moveFrameRef.current !== null) {
      window.cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const src = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Scale down if image is too large
        let w = img.width;
        let h = img.height;
        const maxSize = 300;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w *= ratio;
          h *= ratio;
        }

        const newImage: CanvasObject = {
          id: `img-${Date.now()}`,
          type: 'image',
          x: 1200 - w / 2, // Center of canvas
          y: 900 - h / 2,
          width: w,
          height: h,
          src,
          isSelected: true
        };
        setObjects(prev => [...clearSelection(prev), newImage]);
        setActiveTool('select');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectedTextObjects = useMemo(
    () => objects.filter(obj => obj.isSelected && obj.type === 'text'),
    [objects]
  );
  const selectedTextObj = selectedTextObjects.length === 1 ? selectedTextObjects[0] : null;

  const selectedImageObjects = useMemo(
    () => objects.filter(obj => obj.isSelected && obj.type === 'image'),
    [objects]
  );
  const selectedImageObj = selectedImageObjects.length === 1 ? selectedImageObjects[0] : null;

  const updateSelectedText = (updates: Partial<CanvasObject>) => {
    if (!selectedTextObj) return;
    setObjects(prev => prev.map(obj => 
      obj.id === selectedTextObj.id ? { ...obj, ...updates } : obj
    ));
  };

  const updateSelectedImage = (updates: Partial<CanvasObject>) => {
    if (!selectedImageObj) return;
    setObjects(prev => prev.map(obj => 
      obj.id === selectedImageObj.id ? { ...obj, ...updates } : obj
    ));
  };

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

  const applyTextFormat = (e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault(); // Prevent losing focus
    document.execCommand(command, false, value);
    
    if (editingObjectId) {
      const el = document.getElementById(`text-edit-${editingObjectId}`);
      if (el) {
        setObjects(prev => prev.map(o => o.id === editingObjectId ? { ...o, content: el.innerHTML } : o));
      }
    }
  };

  const handlePromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading || !chatRef.current) return;
    
    setIsLoading(true);
    setAiStatus('Подготовка контекста...');
    const currentPrompt = prompt;
    setPrompt('');

    try {
      const messageParts: any[] = [];
      
      // Find new images
      const currentImages = objects.filter(o => o.type === 'image' && o.src);
      const newImages = currentImages.filter(o => !sentImagesRef.current.has(o.id));
      
      newImages.forEach(img => {
        if (img.src) {
          const [prefix, base64Data] = img.src.split(',');
          const mimeType = prefix.split(';')[0].split(':')[1];
          messageParts.push({
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          });
          messageParts.push({ text: `[Image ID: ${img.id} attached above]` });
          sentImagesRef.current.add(img.id);
        }
      });

      const stateContext = `Canvas state:
${JSON.stringify(objects.map(o => ({
  id: o.id, type: o.type, x: Math.round(o.x), y: Math.round(o.y), 
  w: Math.round(o.width), h: Math.round(o.height), 
  c: o.content ? o.content.substring(0, 50) : undefined
}))) }

Req: ${currentPrompt}`;

      messageParts.push({ text: stateContext });

      setAiStatus('Ожидание ответа от ИИ...');
      const response = await chatRef.current.sendMessage({ message: messageParts });

      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === 'modifyCanvas') {
            setAiStatus('Обновление объектов на холсте...');
            const args = call.args as any;
            
            setObjects(prev => {
              let next = [...prev];
              
              if (args.delete && Array.isArray(args.delete)) {
                next = next.filter(o => !args.delete.includes(o.id));
              }
              
              if (args.update && Array.isArray(args.update)) {
                args.update.forEach((u: any) => {
                  const idx = next.findIndex(o => o.id === u.id);
                  if (idx !== -1) {
                    next[idx] = { ...next[idx], ...u };
                  }
                });
              }
              
              if (args.add && Array.isArray(args.add)) {
                args.add.forEach((a: any) => {
                  next.push({
                    ...a,
                    id: `${a.type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    isSelected: false
                  });
                });
              }
              
              return next;
            });
          } else if (call.name === 'generateImage') {
            setAiStatus('Генерация изображения (это может занять некоторое время)...');
            const args = call.args as any;
            try {
              const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
              const imgResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: args.prompt }] }
              });
              
              let base64Image = '';
              for (const part of imgResponse.candidates?.[0]?.content?.parts || []) {
                if (part.inlineData) {
                  base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                  break;
                }
              }
              
              if (base64Image) {
                setObjects(prev => [...prev, {
                  id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  type: 'image',
                  x: 1200 - 256 + Math.random() * 100,
                  y: 900 - 256 + Math.random() * 100,
                  width: 512,
                  height: 512,
                  src: base64Image,
                  isSelected: false
                }]);
              }
            } catch (err) {
              console.error("Image generation error:", err);
              alert("Ошибка при генерации изображения.");
            }
          } else if (call.name === 'editImage') {
            setAiStatus('Редактирование изображения (это может занять некоторое время)...');
            const args = call.args as any;
            try {
              const parts: any[] = [];
              for (const id of args.imageIds) {
                const obj = objects.find(o => o.id === id);
                if (obj && obj.type === 'image' && obj.src) {
                  const [prefix, data] = obj.src.split(',');
                  const mimeType = prefix.split(';')[0].split(':')[1];
                  parts.push({
                    inlineData: {
                      data: data,
                      mimeType: mimeType
                    }
                  });
                }
              }
              
              if (parts.length > 0) {
                parts.push({ text: args.prompt });
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const imgResponse = await ai.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: { parts }
                });
                
                let base64Image = '';
                for (const part of imgResponse.candidates?.[0]?.content?.parts || []) {
                  if (part.inlineData) {
                    base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    break;
                  }
                }
                
                if (base64Image) {
                  setObjects(prev => [...prev, {
                    id: `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    type: 'image',
                    x: 1200 - 256 + Math.random() * 100,
                    y: 900 - 256 + Math.random() * 100,
                    width: 512,
                    height: 512,
                    src: base64Image,
                    isSelected: false
                  }]);
                }
              } else {
                alert("Не удалось найти изображения для редактирования.");
              }
            } catch (err) {
              console.error("Image editing error:", err);
              alert("Ошибка при редактировании изображения.");
            }
          }
        }
      }
    } catch (error) {
      console.error("AI Error:", error);
      alert("Ошибка при обращении к ИИ. Проверьте консоль.");
    } finally {
      setIsLoading(false);
      setAiStatus(null);
    }
  };

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
    if (fileInputLoadRef.current) fileInputLoadRef.current.value = '';
  };

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 overflow-hidden touch-none transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900' : 'bg-neutral-100'}`}
    >
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
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onPointerLeave={handleCanvasPointerUp}
          style={{ cursor: activeTool === 'text' ? 'text' : 'crosshair' }}
        >
          <canvas
            ref={canvasRef}
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
            <div
              key={obj.id}
              className={`absolute border-2 ${obj.isSelected ? 'border-blue-500 shadow-lg' : 'border-transparent'} ${obj.type === 'text' ? 'cursor-text' : ''}`}
              style={{
                left: obj.x,
                top: obj.y,
                width: obj.width,
                height: obj.type === 'text' ? 'auto' : obj.height,
                minHeight: obj.type === 'text' ? 50 : undefined,
                zIndex: obj.isSelected ? 10 : 1, // Bring selected to front
              }}
              onPointerDown={(e) => {
                if (activeTool === 'select') {
                  if (editingObjectId === obj.id) {
                    e.stopPropagation();
                    return;
                  }
                  
                  e.stopPropagation();
                  
                  // Calculate offset for dragging
                  const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                  const mouseX = (e.clientX - rect.left) / transform.scale;
                  const mouseY = (e.clientY - rect.top) / transform.scale;
                  
                  let draggedIds = [obj.id];
                  
                  if (obj.isSelected) {
                    draggedIds = objects.filter(o => o.isSelected).map(o => o.id);
                  } else {
                    setObjects(prev => {
                      const newObjs = prev.map(o => ({ ...o, isSelected: o.id === obj.id }));
                      const selected = newObjs.find(o => o.id === obj.id);
                      const others = newObjs.filter(o => o.id !== obj.id);
                      return selected ? [...others, selected] : newObjs;
                    });
                  }

                  const initialPositions: Record<string, {x: number, y: number}> = {};
                  objects.forEach(o => {
                    if (draggedIds.includes(o.id)) {
                      initialPositions[o.id] = { x: o.x, y: o.y };
                    }
                  });
                  
                  setDragContext({
                    startX: mouseX,
                    startY: mouseY,
                    initialPositions
                  });
                }
              }}
              onDoubleClick={(e) => {
                if (obj.type === 'text' && activeTool === 'select') {
                  e.stopPropagation();
                  setEditingObjectId(obj.id);
                }
              }}
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
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setResizingObject({ id: obj.id, startX: e.clientX, startY: e.clientY, startWidth: obj.width, startHeight: obj.height, type: 'text' });
                  }}
                >
                  <div className="w-1.5 h-6 bg-white border border-blue-500 rounded-full shadow-sm" />
                </div>
              )}

              {/* Proportional Resize Handle for Image */}
              {obj.isSelected && obj.type === 'image' && (
                <div 
                  className="absolute -bottom-4 -right-4 w-8 h-8 cursor-nwse-resize z-20 flex items-center justify-center"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setResizingObject({ id: obj.id, startX: e.clientX, startY: e.clientY, startWidth: obj.width, startHeight: obj.height, type: 'image' });
                  }}
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
                  onBlur={(e) => {
                    const newContent = e.currentTarget.innerHTML;
                    setObjects(prev => prev.map(o => 
                      o.id === obj.id ? { ...o, content: newContent } : o
                    ));
                  }}
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
            </div>
          ))}
        </div>
      </div>
      
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
            onClick={() => setIsDarkMode(!isDarkMode)}
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

      {/* Top Formatting Toolbar for Text */}
      {selectedTextObj && (
        <div 
          className={`absolute pointer-events-auto flex items-center gap-2 p-2 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}
          style={getToolbarStyle(selectedTextObj)}
        >
          {/* Edit Button */}
          <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
            <button
              onClick={() => setEditingObjectId(selectedTextObj.id)}
              className={`p-1.5 rounded-lg ${editingObjectId === selectedTextObj.id ? 'bg-blue-500 text-white' : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}
              title="Редактировать текст"
            >
              <Edit2 size={18} />
            </button>
          </div>

          {/* Rich Text Formatting (only active when editing) */}
          <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'} ${editingObjectId !== selectedTextObj.id ? 'opacity-50 pointer-events-none' : ''}`}>
            <button onMouseDown={(e) => applyTextFormat(e, 'bold')} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}><Bold size={18} /></button>
            <button onMouseDown={(e) => applyTextFormat(e, 'italic')} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}><Italic size={18} /></button>
            <button onMouseDown={(e) => applyTextFormat(e, 'underline')} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}><Underline size={18} /></button>
            
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
                        applyTextFormat(e, 'foreColor', c);
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
            <button onClick={() => updateSelectedText({ fontSize: Math.max(8, (selectedTextObj.fontSize || 16) - 2) })} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}>-</button>
            <span className={`w-8 text-center text-sm font-medium ${isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}`}>{selectedTextObj.fontSize || 16}</span>
            <button onClick={() => updateSelectedText({ fontSize: Math.min(120, (selectedTextObj.fontSize || 16) + 2) })} className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700'}`}>+</button>
          </div>
          
          <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
            <button onClick={() => updateSelectedText({ textAlign: 'left' })} className={`p-1.5 rounded-lg ${selectedTextObj.textAlign === 'left' ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100/50 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}><AlignLeft size={18} /></button>
            <button onClick={() => updateSelectedText({ textAlign: 'center' })} className={`p-1.5 rounded-lg ${selectedTextObj.textAlign === 'center' ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100/50 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}><AlignCenter size={18} /></button>
            <button onClick={() => updateSelectedText({ textAlign: 'right' })} className={`p-1.5 rounded-lg ${selectedTextObj.textAlign === 'right' ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100/50 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700/50 text-neutral-200' : 'hover:bg-neutral-200/50 text-neutral-700')}`}><AlignRight size={18} /></button>
          </div>

          {/* Block Color Picker */}
          <div className={`flex items-center px-2 border-r relative ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
            <button
              onClick={() => { setShowBlockColorPicker(!showBlockColorPicker); setShowTextColorPicker(false); }}
              className="w-6 h-6 rounded-full border-2 border-neutral-300 dark:border-neutral-600"
              style={{ backgroundColor: selectedTextObj.color || (isDarkMode ? '#ffffff' : '#000000') }}
              title="Цвет всего блока"
            />
            {showBlockColorPicker && (
              <div className={`absolute top-full mt-2 left-0 p-2 rounded-xl shadow-xl backdrop-blur-md border flex gap-1 z-50 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}>
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      updateSelectedText({ color: c });
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
              onClick={() => setObjects(prev => prev.filter(o => o.id !== selectedTextObj.id))}
              className={`p-1.5 rounded-lg text-red-500 ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-100'}`}
              title="Удалить"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Top Formatting Toolbar for Image */}
      {selectedImageObj && (
        <div 
          className={`absolute pointer-events-auto flex items-center gap-2 p-2 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/60 border-white/10' : 'bg-white/60 border-white/40'}`}
          style={getToolbarStyle(selectedImageObj)}
        >
          <div className={`flex items-center gap-1 px-2 border-r ${isDarkMode ? 'border-neutral-600/50' : 'border-neutral-300/50'}`}>
            <button
              onClick={() => updateSelectedImage({ borderRadius: 0 })}
              className={`p-1.5 rounded-lg ${selectedImageObj.borderRadius === 0 || !selectedImageObj.borderRadius ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-700')}`}
              title="Прямые углы"
            >
              <Square size={18} />
            </button>
            <button
              onClick={() => updateSelectedImage({ borderRadius: 16 })}
              className={`p-1.5 rounded-lg ${selectedImageObj.borderRadius === 16 ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-700')}`}
              title="Скругленные углы"
            >
              <div className="w-[18px] h-[18px] border-2 border-current rounded-md" />
            </button>
            <button
              onClick={() => updateSelectedImage({ borderRadius: 9999 })}
              className={`p-1.5 rounded-lg ${selectedImageObj.borderRadius === 9999 ? (isDarkMode ? 'bg-blue-900/50 text-blue-400' : 'bg-blue-100 text-blue-600') : (isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-700')}`}
              title="Круг"
            >
              <Circle size={18} />
            </button>
          </div>

          {/* Delete Button */}
          <div className="flex items-center px-2">
            <button
              onClick={() => setObjects(prev => prev.filter(o => o.id !== selectedImageObj.id))}
              className={`p-1.5 rounded-lg text-red-500 ${isDarkMode ? 'hover:bg-red-900/30' : 'hover:bg-red-100'}`}
              title="Удалить"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Left Toolbar */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
        <div className={`flex flex-col gap-1.5 p-1.5 rounded-2xl shadow-lg backdrop-blur-md border transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900/50 border-white/10' : 'bg-white/50 border-white/40'}`}>
          <button
            onClick={() => setActiveTool('select')}
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
            onClick={() => setActiveTool('text')}
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

      {/* Bottom AI Prompt & Upload */}
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

        <form onSubmit={handlePromptSubmit} className="flex-1 relative flex items-center">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
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
    </div>
  );
}
