import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { prompt, year } = req.body || {};
    if (!prompt || !year) return res.status(400).json({ error: 'Missing prompt or year' });

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a list of recommended events for a professional annual planner for the year ${year}. Context: ${prompt}. Return at least 15 events spread across the year.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              date: { type: Type.STRING, description: 'ISO date format YYYY-MM-DD' },
              category: { type: Type.STRING },
              description: { type: Type.STRING }
            },
            required: ['title', 'date', 'category']
          }
        }
      }
    });

    const text = response.text || '[]';
    let data = [];
    try { data = JSON.parse(text); } catch (err) { data = []; }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Gemini API error:', error);
    return res.status(500).json({ error: String(error) });
  }
}
