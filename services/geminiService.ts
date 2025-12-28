
import { GoogleGenAI, Type } from "@google/genai";

// Fix: Initialize GoogleGenAI with process.env.API_KEY directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSmartSchedule = async (prompt: string, year: number) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a list of recommended events for a professional annual planner for the year ${year}. 
      Context: ${prompt}. 
      Return at least 15 events spread across the year.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              date: { type: Type.STRING, description: "ISO date format YYYY-MM-DD" },
              // Fix: Align category enum with application's defined logistics phases
              category: { 
                type: Type.STRING, 
                enum: ['local_process', 'tec_processing', 'tec_approved', 'customs_clearance', 'delivery'] 
              },
              description: { type: Type.STRING }
            },
            required: ["title", "date", "category"]
          }
        }
      }
    });

    // Fix: Access .text property directly from response
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
};
