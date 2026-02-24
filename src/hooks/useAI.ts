import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, FunctionDeclaration, Type as GenAIType } from '@google/genai';
import { CanvasObject } from '../types/canvas';
import { getQuestionSystemPromptAdditions } from '../utils/questionBlockHelpers';
import { UserProfile } from '../types/question';

interface UseAIProps {
  objects: CanvasObject[];
  setObjects: React.Dispatch<React.SetStateAction<CanvasObject[]>>;
  userProfile: UserProfile;
  addConfidenceToHistory: (confidence: number) => void;
  createQuestionBlock: (x: number, y: number, question: string, answerType: 'single' | 'multiple' | 'text', options?: string[], explanation?: string, confidence?: number) => CanvasObject;
}

export const useAI = ({
  objects,
  setObjects,
  userProfile,
  addConfidenceToHistory,
  createQuestionBlock
}: UseAIProps) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  
  const chatRef = useRef<any>(null);
  const sentImagesRef = useRef<Set<string>>(new Set());

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

    const askQuestionDeclaration: FunctionDeclaration = {
      name: "askQuestion",
      description: "Asks user a clarifying question to better understand their goal. Use this if context is unclear (confidence < 70%), need clarification for correct result, first time seeing a pattern, or contradictions in actions. DO NOT use if already known from history, can be inferred, or recently asked.",
      parameters: {
        type: GenAIType.OBJECT,
        properties: {
          question: { type: GenAIType.STRING, description: "The question to ask the user." },
          answerType: { type: GenAIType.STRING, description: "'single', 'multiple', or 'text'" },
          options: { 
            type: GenAIType.ARRAY, 
            items: { type: GenAIType.STRING },
            description: "Options for single or multiple choice questions."
          },
          explanation: { type: GenAIType.STRING, description: "Friendly explanation of why you are asking this." },
          confidence: { type: GenAIType.NUMBER, description: "AI confidence level before asking (0-100)." }
        },
        required: ["question", "answerType", "explanation", "confidence"]
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
5. You can modify the canvas (modifyCanvas), generate new images (generateImage), edit existing images (editImage), or ask clarifying questions (askQuestion). Output the appropriate tool call based on the user's request.
${getQuestionSystemPromptAdditions(userProfile)}`,
        tools: [{ functionDeclarations: [modifyCanvasDeclaration, generateImageDeclaration, editImageDeclaration, askQuestionDeclaration] }],
        temperature: 0.1,
      }
    });
  }, [userProfile]);

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
          } else if (call.name === 'askQuestion') {
            setAiStatus('Добавление вопроса на холст...');
            const args = call.args as any;
            
            // Add confidence to history
            addConfidenceToHistory(args.confidence);

            const newQuestion = createQuestionBlock(
              1200 - 150 + Math.random() * 50,
              900 - 100 + Math.random() * 50,
              args.question,
              args.answerType,
              args.options,
              args.explanation,
              args.confidence
            );

            setObjects(prev => [...prev, newQuestion]);
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

  return {
    prompt,
    setPrompt,
    isLoading,
    aiStatus,
    handlePromptSubmit
  };
};
