
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { base64Image } = req.body;
  if (!base64Image) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'System API key not configured on server. Please check Vercel environment variables.' });
  }

  try {
    // Explicitly use named parameter for initialization
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: 'Extract the Part Number, Part Name, and Quantity from this industrial dispatch tag. Look for anchors like "PART NO", "PART NAME", and "QTY" or "NOS". Return JSON.' },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            partNo: { type: Type.STRING },
            partName: { type: Type.STRING },
            qty: { type: Type.INTEGER }
          },
          required: ["partNo", "partName", "qty"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");
    
    return res.status(200).json({
      partNo: data.partNo || "UNKNOWN",
      partName: data.partName || "UNKNOWN",
      qty: data.qty || 0,
      confidence: 0.99,
      rawText: response.text || "",
    });
  } catch (err: any) {
    console.error("Gemini Proxy Server Error:", err);
    return res.status(500).json({ error: err.message || 'AI Processing Error' });
  }
}
