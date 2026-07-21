/**
 * Anthropic Claude Vision OCR Provider
 *
 * Uses the Claude messages API with a vision-capable model to extract
 * structured receipt data from an image in a single pass.
 *
 * Required env: ANTHROPIC_API_KEY
 */

const fs = require('fs');
const { normalizeOcrResult, parseJsonResponse, SYSTEM_PROMPT, USER_PROMPT } = require('./types');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-opus-4-5';

/**
 * @param {string} imagePath   — Absolute path to the uploaded image file
 * @param {string} mimeType    — MIME type of the image (image/jpeg, image/png, image/webp)
 * @returns {Promise<import('./types').OcrResult>}
 */
async function extractWithAnthropic(imagePath, mimeType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'replace_me_if_you_have_api_key') {
    throw Object.assign(new Error('Anthropic API key not configured.'), { isProviderConfig: true });
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            { type: 'text', text: USER_PROMPT },
          ],
        },
      ],
    }),
  });

  if (response.status === 401) {
    throw Object.assign(
      new Error('Anthropic API key tidak valid. Periksa konfigurasi ANTHROPIC_API_KEY.'),
      { isProviderConfig: true }
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const textBlock = data.content && data.content.find((c) => c.type === 'text');
  if (!textBlock || !textBlock.text) {
    throw new Error('Anthropic: model did not return a text block.');
  }

  const rawText = textBlock.text;
  const parsed = parseJsonResponse(rawText);
  return normalizeOcrResult(parsed, rawText);
}

module.exports = { extractWithAnthropic };
