
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { OCRResult } from "../types";
import { settingsService } from "./settingsService";
import { logger } from "./logger";

/**
 * Cloud OCR Service
 * Handles both local direct-to-Gemini calls (for custom keys) 
 * and proxied calls (for system keys) to ensure reliable performance on Vercel.
 */
export async function performOCR(base64Image: string): Promise<OCRResult> {
  const settings = settingsService.getSettings();
  
  // If custom key is enabled and provided, we call Google directly from the client
  if (settings.useCustomApiKey && settings.customApiKey?.trim()) {
    const apiKey = settings.customApiKey.trim();
    logger.info('Performing direct OCR with custom user API key.');
    
    // Create a new GoogleGenAI instance right before making an API call to ensure it uses the latest key.
    const ai = new GoogleGenAI({ apiKey: apiKey });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: 'OCR this industrial tag. Extract: Part Number (partNo), Part Name (partName), Quantity (qty). Return JSON only.' },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
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
      logger.info('Direct OCR success', data);
      
      return {
        partNo: data.partNo || "UNKNOWN",
        partName: data.partName || "UNKNOWN",
        qty: data.qty || 0,
        confidence: 0.99,
        rawText: response.text || "",
      };
    } catch (err: any) {
      logger.error("Direct OCR Service Error", err);
      throw new Error(err.message || "Failed to process image with Gemini AI.");
    }
  } 
  
  // Fallback: Use the secure Serverless Proxy (/api/gemini)
  logger.info('Performing OCR via secure system proxy.');
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s hard timeout

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    logger.info('Proxy OCR success', data);
    return {
      partNo: data.partNo,
      partName: data.partName,
      qty: data.qty,
      confidence: data.confidence,
      rawText: data.rawText
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error("Proxy OCR Service Error", err);
    if (err.name === 'AbortError') {
      throw new Error("OCR timeout: The request took too long. Check your internet connection.");
    }
    throw new Error(err.message || "Failed to reach OCR proxy server.");
  }
}
