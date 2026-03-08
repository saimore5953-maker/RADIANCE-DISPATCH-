
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { OCRResult, VehicleOCRResult } from "../types";
import { settingsService } from "./settingsService";
import { logger } from "./logger";

/**
 * Cloud OCR Service for Industrial Tags
 */
export async function performOCR(base64Image: string): Promise<OCRResult> {
  const settings = settingsService.getSettings();
  
  if (settings.useCustomApiKey && settings.customApiKey?.trim()) {
    const apiKey = settings.customApiKey.trim();
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
  
  return callProxyOCR(base64Image, 'industrial') as Promise<OCRResult>;
}

/**
 * Cloud OCR Service for Vehicle Number Plates
 */
export async function performVehicleOCR(base64Image: string): Promise<VehicleOCRResult> {
  const settings = settingsService.getSettings();
  
  if (settings.useCustomApiKey && settings.customApiKey?.trim()) {
    const apiKey = settings.customApiKey.trim();
    const ai = new GoogleGenAI({ apiKey: apiKey });

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: 'OCR this vehicle number plate. The format is: TWO LETTERS, 2-DIGIT NUMBER (01-99), ONE OR TWO LETTERS, and 4-DIGIT NUMBER (0001-9999). Example: MH12AB1234. Extract the registration number. Return JSON with key "vehicleNo".' },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              vehicleNo: { type: Type.STRING }
            },
            required: ["vehicleNo"]
          }
        }
      });

      const data = JSON.parse(response.text || "{}");
      return {
        vehicleNo: data.vehicleNo || "UNKNOWN",
        confidence: 0.99,
        rawText: response.text || "",
      };
    } catch (err: any) {
      logger.error("Direct Vehicle OCR Error", err);
      throw new Error(err.message || "Failed to process vehicle image.");
    }
  } 
  
  return callProxyOCR(base64Image, 'vehicle') as Promise<VehicleOCRResult>;
}

async function callProxyOCR(base64Image: string, type: 'industrial' | 'vehicle'): Promise<OCRResult | VehicleOCRResult> {
  logger.info(`Performing ${type} OCR via secure system proxy.`);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image, type }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    clearTimeout(timeoutId);
    logger.error("Proxy OCR Service Error", err);
    throw new Error(err.message || "Failed to reach OCR proxy server.");
  }
}
