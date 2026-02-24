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

export interface PointerMoveSnapshot {
  clientX: number;
  clientY: number;
  movementX: number;
  movementY: number;
  target: HTMLDivElement;
}
