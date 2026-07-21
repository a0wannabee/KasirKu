/**
 * OpenAI GPT-4o Vision OCR Provider
 *
 * Uses the OpenAI Chat Completions API with vision to extract structured
 * receipt data from an image in a single pass.
 *
 * Required env: OPENAI_API_KEY
 * Optional env: OPENAI_MODEL (default: gpt-4o-mini)
 */

const fs = require('fs');
const { normalizeOcrResult, parseJsonResponse, SYSTEM_PROMPT, USER_PROMPT } = require('./types');

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * @param {string} imagePath   — Absolute path to the uploaded image file
 * @param {string} mimeType    — MIME type of the image
 * @returns {Promise<import('./types').OcrResult>}
 */
async function extractWithOpenAI(imagePath, mimeType) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'replace_me_if_you_have_api_key') {
    throw Object.assign(new Error('OpenAI API key not configured.'), { isProviderConfig: true });
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
    }),
  });

  if (response.status === 401) {
    throw Object.assign(
      new Error('OpenAI API key tidak valid. Periksa konfigurasi OPENAI_API_KEY.'),
      { isProviderConfig: true }
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const choice = data.choices && data.choices[0];
  const rawText = choice && choice.message && choice.message.content;

  if (!rawText) {
    throw new Error('OpenAI: model did not return a text response.');
  }

  const parsed = parseJsonResponse(rawText);
  return normalizeOcrResult(parsed, rawText);
}

module.exports = { extractWithOpenAI };
