import { CanvasObject } from './types';
import { getBounds, intersectsBounds } from './geometry';

export const clearSelection = (items: CanvasObject[]) => {
  let changed = false;
  const nextItems = items.map((obj) => {
    if (!obj.isSelected) return obj;
    changed = true;
    return { ...obj, isSelected: false };
  });

  return changed ? nextItems : items;
};

export const applySelectionByRect = (
  items: CanvasObject[],
  startX: number,
  startY: number,
  endX: number,
  endY: number
) => {
  const bounds = getBounds(startX, startY, endX, endY);
  let changed = false;

  const next = items.map((obj) => {
    const isInside = intersectsBounds(obj.x, obj.y, obj.width, obj.height, bounds);
    if (obj.isSelected === isInside) return obj;
    changed = true;
    return { ...obj, isSelected: isInside };
  });

  return changed ? next : items;
};
