
import { GoogleGenAI, Type } from "@google/genai";
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
    
    const ai = new GoogleGenAI({ apiKey: apiKey });
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
      logger.error("Direct OCR Service Error", err);
      throw new Error(err.message || "Failed to process image with Gemini AI.");
    }
  } 
  
  // Fallback: Use the secure Serverless Proxy (/api/gemini)
  // This is required because process.env.API_KEY is not accessible in the browser on Vercel.
  logger.info('Performing OCR via secure system proxy.');
  
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    return {
      partNo: data.partNo,
      partName: data.partName,
      qty: data.qty,
      confidence: data.confidence,
      rawText: data.rawText
    };
  } catch (err: any) {
    logger.error("Proxy OCR Service Error", err);
    throw new Error(err.message || "Failed to reach OCR proxy server.");
  }
}
