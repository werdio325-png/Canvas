import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types/question';
import { CanvasObject } from '../types/canvas';

export function useQuestionBlock(
  objects: CanvasObject[],
  setObjects: React.Dispatch<React.SetStateAction<CanvasObject[]>>
) {
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('canvas_user_profile');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse user profile", e);
      }
    }
    return {
      id: `user-${Date.now()}`,
      answers: {},
      preferences: {},
      confidenceHistory: []
    };
  });

  useEffect(() => {
    localStorage.setItem('canvas_user_profile', JSON.stringify(userProfile));
  }, [userProfile]);

  const handleAnswerQuestion = (id: string, answer: string | string[]) => {
    const obj = objects.find(o => o.id === id);
    if (!obj || obj.type !== 'question') return;

    setObjects(prev => prev.map(o => 
      o.id === id ? { ...o, answered: true, userAnswer: answer } : o
    ));

    setUserProfile(prev => ({
      ...prev,
      answers: {
        ...prev.answers,
        [obj.question || id]: answer
      }
    }));
  };

  const handleSkipQuestion = (id: string) => {
    setObjects(prev => prev.filter(o => o.id !== id));
  };

  const addConfidenceToHistory = (confidence: number) => {
    setUserProfile(prev => ({
      ...prev,
      confidenceHistory: [...prev.confidenceHistory, confidence].slice(-10)
    }));
  };

  return {
    userProfile,
    handleAnswerQuestion,
    handleSkipQuestion,
    addConfidenceToHistory
  };
}
