import { GoogleGenAI } from "@google/genai";

export function createGeminiClient(baseUrl: string, apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: "", baseUrl },
  });
}
