export interface UserProfile {
  id: string;
  answers: Record<string, string | string[]>;
  preferences: {
    style?: string;
    audience?: string;
    format?: string;
    [key: string]: string | undefined;
  };
  confidenceHistory: number[];
}
