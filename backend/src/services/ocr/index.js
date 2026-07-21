/**
 * OCR Provider Factory
 *
 * Reads the OCR_PROVIDER environment variable and returns the appropriate
 * extraction function. The frontend never needs to know which provider is
 * active — it always receives the same OcrResult shape.
 *
 * Supported providers (set via OCR_PROVIDER env var):
 *   anthropic  — Claude vision (ANTHROPIC_API_KEY)
 *   gemini     — Google Gemini vision (GOOGLE_API_KEY)
 *   openai     — GPT-4o vision (OPENAI_API_KEY)
 *
 * If OCR_PROVIDER is not set or the key is missing/placeholder, a structured
 * error is returned to the caller so the frontend can display a clear message.
 */

const { AppError } = require('../../utils/AppError');
const { extractWithAnthropic } = require('./anthropicProvider');
const { extractWithGemini }    = require('./geminiProvider');
const { extractWithOpenAI }    = require('./openaiProvider');

const SUPPORTED_PROVIDERS = ['anthropic', 'gemini', 'openai'];

/**
 * Returns information about which provider is configured.
 * Safe to expose to authenticated clients (no secret values).
 *
 * @returns {{ configured: boolean, provider: string|null, message: string }}
 */
function getOcrStatus() {
  const provider = (process.env.OCR_PROVIDER || '').toLowerCase().trim();
  if (!provider || !SUPPORTED_PROVIDERS.includes(provider)) {
    return {
      configured: false,
      provider: null,
      message: `OCR_PROVIDER tidak dikonfigurasi atau tidak valid. Nilai yang didukung: ${SUPPORTED_PROVIDERS.join(', ')}.`,
    };
  }

  const keyMap = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini:    process.env.GOOGLE_API_KEY,
    openai:    process.env.OPENAI_API_KEY,
  };

  const key = keyMap[provider];
  const placeholder = 'replace_me_if_you_have_api_key';
  if (!key || key === placeholder) {
    return {
      configured: false,
      provider,
      message: `Provider "${provider}" dikonfigurasi tetapi API key belum diisi. Tambahkan ke environment variable.`,
    };
  }

  return { configured: true, provider, message: 'OCR provider siap digunakan.' };
}

/**
 * Extracts structured receipt data from an image using the configured provider.
 *
 * @param {string} imagePath   — Absolute path to the uploaded image file
 * @param {string} mimeType    — MIME type of the image
 * @returns {Promise<import('./types').OcrResult>}
 * @throws {AppError} if OCR is not configured or the provider returns an auth error
 */
async function extractReceiptData(imagePath, mimeType) {
  const status = getOcrStatus();
  if (!status.configured) {
    throw new AppError(status.message, 503, 'OCR_NOT_CONFIGURED');
  }

  const provider = status.provider;
  try {
    if (provider === 'anthropic') return await extractWithAnthropic(imagePath, mimeType);
    if (provider === 'gemini')    return await extractWithGemini(imagePath, mimeType);
    if (provider === 'openai')    return await extractWithOpenAI(imagePath, mimeType);
  } catch (err) {
    console.error("========== OCR EXTRACTION ERROR ==========");
    console.error("Provider:", provider);
    console.error("Error Message:", err?.message);
    console.error("Error Status:", err?.status);
    console.error("Error Stack:", err?.stack);
    console.error("==========================================");

    // Provider config errors (bad key, etc.) → surface as safe AppError
    if (err.isProviderConfig) {
      throw new AppError(err.message, 503, 'OCR_PROVIDER_AUTH_FAILED');
    }
    // JSON parse failure → let caller know OCR ran but result was unparseable
    if (err.message && err.message.includes('JSON')) {
      throw new AppError(
        'OCR berhasil dijalankan tetapi hasil ekstraksi tidak dapat diparsing. Coba foto dengan pencahayaan yang lebih baik.',
        422,
        'OCR_PARSE_FAILED'
      );
    }
    // Everything else → unknown provider error
    const detailMsg = err?.message ? ` Detail: ${err.message}` : '';
    throw new AppError(
      `Layanan OCR tidak tersedia saat ini (${provider}).${detailMsg}`,
      503,
      'OCR_PROVIDER_ERROR'
    );
  }
}

module.exports = { extractReceiptData, getOcrStatus };
