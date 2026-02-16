
import { GoogleGenAI, Type } from "@google/genai";
import { OCRResult } from "../types";
import { settingsService } from "./settingsService";
import { logger } from "./logger";

/**
 * Cloud OCR Service (Restored to direct client-side calling)
 */
export async function performOCR(base64Image: string): Promise<OCRResult> {
  const settings = settingsService.getSettings();
  
  // Safe access to process.env to prevent crash in browser environments
  const envApiKey = typeof process !== 'undefined' ? process.env?.API_KEY : undefined;

  // Use custom key if enabled, otherwise fall back to system key
  const apiKey = (settings.useCustomApiKey && settings.customApiKey) 
    ? settings.customApiKey 
    : envApiKey;

  if (!apiKey) {
    throw new Error("Gemini API Key is not configured. Please check your settings or environment variables.");
  }

  logger.info(settings.useCustomApiKey ? 'Performing OCR with custom user API key.' : 'Performing OCR with system API key.');
  
  const ai = new GoogleGenAI({ apiKey });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), settings.ocrTimeoutSec * 1000);

  try {
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
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    const data = JSON.parse(response.text || "{}");
    
    return {
      partNo: data.partNo || "UNKNOWN",
      partName: data.partName || "UNKNOWN",
      qty: data.qty || 0,
      confidence: 0.99,
      rawText: response.text || "",
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error("OCR Service Error", err);
    throw new Error(err.message || "Failed to process image with Gemini AI.");
  }
}
