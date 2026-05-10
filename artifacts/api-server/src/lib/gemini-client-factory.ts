import { GoogleGenAI } from "@google/genai";

export function createGeminiClient(baseUrl: string | null | undefined, apiKey: string): GoogleGenAI {
  if (baseUrl && baseUrl.trim()) {
    return new GoogleGenAI({
      apiKey,
      // Keep SDK default API version (v1beta) to avoid 404 on Google endpoint.
      httpOptions: { baseUrl: baseUrl.trim() },
    });
  }
  // Fallback to SDK defaults when explicit base URL is not provided.
  return new GoogleGenAI({ apiKey });
}
