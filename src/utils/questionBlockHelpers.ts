import { CanvasObject } from '../types/canvas';

export const createQuestionBlock = (
  x: number,
  y: number,
  question: string,
  answerType: 'single' | 'multiple' | 'text',
  options: string[] | undefined,
  explanation: string,
  confidence: number
): CanvasObject => {
  return {
    id: `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'question',
    x,
    y,
    width: 300,
    height: 250,
    question,
    answerType,
    options,
    explanation,
    confidence,
    answered: false,
    isSelected: false
  };
};

export const getQuestionSystemPromptAdditions = (userProfile: any) => {
  return `
User Profile so far:
- Preferences: ${JSON.stringify(userProfile.preferences)}
- Previous answers: ${JSON.stringify(userProfile.answers)}

Use this context to be more accurate in next suggestions. Only ask questions if you really need to (confidence < 70%).`;
};
