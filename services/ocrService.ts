
import { OCRResult } from "../types";
import { PARSE_RULES } from "../constants";

/**
 * On-Device OCR Service (Offline-First)
 * Uses local processing to avoid API quotas and enable airplane-mode scanning.
 */

// We use esm.sh to load Tesseract locally in a web environment
// In a true Flutter build, this would map to google_mlkit_text_recognition
import Tesseract from 'https://esm.sh/tesseract.js@5.1.1';

export async function performLocalOCR(base64Image: string): Promise<OCRResult> {
  try {
    // 1. Image Preprocessing (Downscaling to ~1024px for performance)
    const processedImage = await preprocessForOCR(base64Image);

    // 2. Run Local OCR (In a Worker thread to prevent UI jank)
    const { data: { text } } = await Tesseract.recognize(
      `data:image/jpeg;base64,${processedImage}`,
      'eng',
      { logger: m => console.debug(m.status, (m.progress * 100).toFixed(0) + '%') }
    );

    // 3. Deterministic Parsing using Regex Rules from constants.ts
    const partNoMatch = text.match(PARSE_RULES.PART_NO);
    const partNameMatch = text.match(PARSE_RULES.PART_NAME);
    const qtyMatch = text.match(PARSE_RULES.QTY);

    return {
      partNo: partNoMatch ? partNoMatch[1].trim() : "UNKNOWN",
      partName: partNameMatch ? partNameMatch[1].trim() : "UNKNOWN",
      qty: qtyMatch ? parseInt(qtyMatch[1], 10) : 0,
      confidence: 0.85, 
      rawText: text,
    };
  } catch (error) {
    console.error("Local OCR Failed:", error);
    throw new Error("Local OCR Error. Please use Manual Entry.");
  }
}

async function preprocessForOCR(base64: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024;
      const scale = MAX_WIDTH / img.width;
      
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
      } else {
        resolve(base64);
      }
    };
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}
