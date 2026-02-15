
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";
import { settingsService } from "./settingsService";

/**
 * Cloud OCR Service (Gemini 3 Flash)
 * Restored version for high-accuracy industrial tag extraction.
 */
export async function performOCR(base64Image: string): Promise<OCRResult> {
  const settings = settingsService.getSettings();
  
  // Use custom key if enabled and provided, otherwise fallback to system key
  const activeApiKey = (settings.useCustomApiKey && settings.customApiKey) 
    ? settings.customApiKey 
    : process.env.API_KEY;

  if (!activeApiKey) {
    throw new Error("API Key not configured. Please check Settings.");
  }

  // Always create a new instance right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: activeApiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image,
            },
          },
          {
            text: 'Extract the Part Number, Part Name, and Quantity from this industrial dispatch tag. Look for anchors like "PART NO", "PART NAME", and "QTY" or "NOS". Return JSON.',
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            partNo: { 
              type: Type.STRING,
              description: "The alphanumeric part number"
            },
            partName: { 
              type: Type.STRING,
              description: "The descriptive part name"
            },
            qty: { 
              type: Type.INTEGER,
              description: "The numeric quantity"
            }
          },
          required: ["partNo", "partName", "qty"]
        }
      }
    });

    // response.text is a property, which is correctly used here.
    const data = JSON.parse(response.text || "{}");
    return {
      partNo: data.partNo || "UNKNOWN",
      partName: data.partName || "UNKNOWN",
      qty: data.qty || 0,
      confidence: 0.99,
      rawText: response.text || "",
    };
  } catch (err: any) {
    console.error("OCR API Error", err);
    
    // Check for common API key errors
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('API key not found')) {
      throw new Error("API Key may be invalid. Update it in Settings.");
    }
    
    throw new Error("Cloud OCR failed. Check connection or use Manual Entry.");
  }
}
