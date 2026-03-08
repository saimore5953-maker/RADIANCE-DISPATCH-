
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { base64Image, type = 'industrial' } = req.body;
  if (!base64Image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'System GEMINI_API_KEY not configured on server.' });
  }

  const prompt = type === 'vehicle' 
    ? 'OCR this vehicle number plate. The format is: TWO LETTERS, 2-DIGIT NUMBER (01-99), ONE OR TWO LETTERS, and 4-DIGIT NUMBER (0001-9999). Example: MH12AB1234. Extract the registration number. Return JSON with key "vehicleNo".'
    : 'OCR this industrial tag. Extract: Part Number (partNo), Part Name (partName), Quantity (qty). Return JSON only.';

  const schema = type === 'vehicle'
    ? {
        type: Type.OBJECT,
        properties: {
          vehicleNo: { type: Type.STRING }
        },
        required: ["vehicleNo"]
      }
    : {
        type: Type.OBJECT,
        properties: {
          partNo: { type: Type.STRING },
          partName: { type: Type.STRING },
          qty: { type: Type.INTEGER }
        },
        required: ["partNo", "partName", "qty"]
      };

  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt },
        ],
      },
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    const data = JSON.parse(response.text || "{}");
    
    if (type === 'vehicle') {
      return res.status(200).json({
        vehicleNo: data.vehicleNo || "UNKNOWN",
        confidence: 0.99,
        rawText: response.text || "",
      });
    }

    return res.status(200).json({
      partNo: data.partNo || "UNKNOWN",
      partName: data.partName || "UNKNOWN",
      qty: data.qty || 0,
      confidence: 0.99,
      rawText: response.text || "",
    });
  } catch (err: any) {
    console.error("Gemini Proxy Error:", err);
    return res.status(500).json({ error: err.message || 'AI Processing Error' });
  }
}
