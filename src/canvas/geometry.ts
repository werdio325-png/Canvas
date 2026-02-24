import { MAX_ZOOM, MIN_ZOOM } from './constants';

export const clampZoom = (scale: number) => Math.max(MIN_ZOOM, Math.min(scale, MAX_ZOOM));

export const getBounds = (startX: number, startY: number, endX: number, endY: number) => ({
  minX: Math.min(startX, endX),
  maxX: Math.max(startX, endX),
  minY: Math.min(startY, endY),
  maxY: Math.max(startY, endY),
});

export const intersectsBounds = (
  x: number,
  y: number,
  width: number,
  height: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
) => x < bounds.maxX && x + width > bounds.minX && y < bounds.maxY && y + height > bounds.minY;
