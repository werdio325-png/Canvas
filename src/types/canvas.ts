export type CanvasObjectType = 'text' | 'image' | 'question';

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
  
  // Question block specific fields
  question?: string;
  answerType?: 'single' | 'multiple' | 'text';
  options?: string[];
  answered?: boolean;
  userAnswer?: string | string[];
  confidence?: number;
  explanation?: string;
}

export interface Transform {
  x: number;
  y: number;
  scale: number;
}
