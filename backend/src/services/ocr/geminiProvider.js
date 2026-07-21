/**
 * Google Gemini Vision OCR Provider
 *
 * Uses the official Google GenAI Developer API SDK to extract
 * structured receipt data from an image in a single pass.
 *
 * Required env: GOOGLE_API_KEY
 * Optional env: GEMINI_MODEL (default: gemini-1.5-flash)
 */

const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');
const { normalizeOcrResult, parseJsonResponse, SYSTEM_PROMPT, USER_PROMPT } = require('./types');

const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

/**
 * @param {string} imagePath   — Absolute path to the uploaded image file
 * @param {string} mimeType    — MIME type of the image
 * @returns {Promise<import('./types').OcrResult>}
 */
async function extractWithGemini(imagePath, mimeType) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === 'replace_me_if_you_have_api_key') {
    throw Object.assign(new Error('Google API key not configured.'), { isProviderConfig: true });
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Image,
          },
        },
        USER_PROMPT,
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Gemini: model did not return a text response.');
    }

    const parsed = parseJsonResponse(rawText);
    return normalizeOcrResult(parsed, rawText);
  } catch (err) {
    console.error('Gemini SDK Error:', err);
    
    const errMsg = err.message || '';
    if (
      errMsg.includes('API_KEY_INVALID') ||
      errMsg.includes('API key not valid') ||
      errMsg.includes('invalid api key') ||
      (err.status === 400 || err.status === 403)
    ) {
      throw Object.assign(
        new Error('Google API key tidak valid. Periksa konfigurasi GOOGLE_API_KEY.'),
        { isProviderConfig: true }
      );
    }
    throw err;
  }
}

module.exports = { extractWithGemini };
