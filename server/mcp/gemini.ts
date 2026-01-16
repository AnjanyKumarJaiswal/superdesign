import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai_model = new GoogleGenAI(
    {
        apiKey: GEMINI_API_KEY,
    }
)

export const gemini = ai_model.models;