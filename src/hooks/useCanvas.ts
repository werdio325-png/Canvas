import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CanvasObject, Transform } from '../types/canvas';

export const useCanvas = (initialObjects: CanvasObject[] = []) => {
  const [objects, setObjects] = useState<CanvasObject[]>(initialObjects);
  const [activeTool, setActiveTool] = useState<'select' | 'text'>('select');
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, scale: 1 });
  
  // Selection and Dragging state
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, endX: number, endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [dragContext, setDragContext] = useState<{ startX: number, startY: number, initialPositions: Record<string, {x: number, y: number}> } | null>(null);
  const [resizingObject, setResizingObject] = useState<{ id: string, startX: number, startY: number, startWidth: number, startHeight: number, type: 'text' | 'image' } | null>(null);
  const isPinchingRef = useRef(false);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [showTextColorPicker, setShowTextColorPicker] = useState(false);
  const [showBlockColorPicker, setShowBlockColorPicker] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

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

  // Touch gestures (pinch zoom)
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

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, isDarkMode: boolean) => {
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
    // Calculate coordinates relative to the unscaled canvas
    const x = (e.clientX - rect.left) / transform.scale;
    const y = (e.clientY - rect.top) / transform.scale;

    if (activeTool === 'select') {
      setIsSelecting(true);
      setSelectionBox({ startX: x, startY: y, endX: x, endY: y });
      
      // Deselect all objects if clicking on empty space
      setObjects(prev => prev.map(obj => ({ ...obj, isSelected: false })));
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
      setObjects(prev => [...prev.map(obj => ({ ...obj, isSelected: false })), newText]);
      setActiveTool('select'); // Switch back to select tool after creating
    }
  }, [activeTool, editingObjectId, showBlockColorPicker, showTextColorPicker, transform.scale]);

  const handleObjectResizeStart = useCallback((e: React.PointerEvent, obj: CanvasObject, type: 'text' | 'image') => {
    e.stopPropagation();
    setResizingObject({ id: obj.id, startX: e.clientX, startY: e.clientY, startWidth: obj.width, startHeight: obj.height, type });
  }, []);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (isPinchingRef.current) return;

    if (isPanning) {
      setTransform(prev => ({
        ...prev,
        x: prev.x + e.movementX,
        y: prev.y + e.movementY
      }));
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
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
    const minX = Math.min(selectionBox.startX, x);
    const maxX = Math.max(selectionBox.startX, x);
    const minY = Math.min(selectionBox.startY, y);
    const maxY = Math.max(selectionBox.startY, y);

    setObjects(prev => prev.map(obj => {
      const isInside = 
        obj.x < maxX && obj.x + obj.width > minX &&
        obj.y < maxY && obj.y + obj.height > minY;
      return { ...obj, isSelected: isInside };
    }));
  }, [activeTool, dragContext, isPanning, isSelecting, resizingObject, selectionBox, transform.scale]);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
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
  }, [dragContext, isPanning, isSelecting, resizingObject]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        setObjects(prev => [...prev.map(o => ({ ...o, isSelected: false })), newImage]);
        setActiveTool('select');
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    
    // Reset input
    e.target.value = '';
  }, []);

  const applyTextFormat = useCallback((e: React.MouseEvent, command: string, value?: string) => {
    e.preventDefault(); // Prevent losing focus
    document.execCommand(command, false, value);
    
    if (editingObjectId) {
      const el = document.getElementById(`text-edit-${editingObjectId}`);
      if (el) {
        setObjects(prev => prev.map(o => o.id === editingObjectId ? { ...o, content: el.innerHTML } : o));
      }
    }
  }, [editingObjectId]);

  const updateSelectedText = useCallback((updates: Partial<CanvasObject>) => {
    setObjects(prev => {
      const selected = prev.find(obj => obj.isSelected && obj.type === 'text');
      if (!selected) return prev;
      return prev.map(obj => 
        obj.id === selected.id ? { ...obj, ...updates } : obj
      );
    });
  }, []);

  const updateSelectedImage = useCallback((updates: Partial<CanvasObject>) => {
    setObjects(prev => {
      const selected = prev.find(obj => obj.isSelected && obj.type === 'image');
      if (!selected) return prev;
      return prev.map(obj => 
        obj.id === selected.id ? { ...obj, ...updates } : obj
      );
    });
  }, []);

  const handleObjectPointerDown = useCallback((e: React.PointerEvent, obj: CanvasObject) => {
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
      
      const target = e.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('button')) {
        // Just select, don't drag
        setDragContext(null);
      } else {
        setDragContext({
          startX: mouseX,
          startY: mouseY,
          initialPositions
        });
      }
    }
  }, [activeTool, editingObjectId, objects, transform.scale]);

  const handleResizeStart = useCallback((e: React.PointerEvent, obj: CanvasObject, type: 'text' | 'image') => {
    e.stopPropagation();
    setResizingObject({ id: obj.id, startX: e.clientX, startY: e.clientY, startWidth: obj.width, startHeight: obj.height, type });
  }, []);

  return {
    objects,
    setObjects,
    activeTool,
    setActiveTool,
    transform,
    setTransform,
    selectionBox,
    isSelecting,
    dragContext,
    setDragContext,
    resizingObject,
    setResizingObject,
    editingObjectId,
    setEditingObjectId,
    isPanning,
    setIsPanning,
    showTextColorPicker,
    setShowTextColorPicker,
    showBlockColorPicker,
    setShowBlockColorPicker,
    containerRef,
    handleCanvasPointerDown,
    handleCanvasPointerMove,
    handleCanvasPointerUp,
    handleImageUpload,
    applyTextFormat,
    updateSelectedText,
    updateSelectedImage,
    handleObjectPointerDown,
    handleObjectResizeStart: handleResizeStart
  };
};
