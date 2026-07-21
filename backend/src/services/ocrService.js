/**
 * ocrService.js — backward-compatible re-export shim.
 *
 * The OCR extraction logic has been refactored into a multi-provider
 * architecture under src/services/ocr/. This file re-exports the public API
 * so existing imports in purchases.routes.js continue to work without change.
 *
 * extractReceiptData — delegates to the configured AI provider (Anthropic /
 *   Gemini / OpenAI) selected via OCR_PROVIDER env var.
 *
 * matchProductName — unchanged fuzzy-matcher kept here because it is purely
 *   local logic with no provider dependency.
 */

const { extractReceiptData, getOcrStatus } = require('./ocr/index');

/**
 * Fuzzy-matches an OCR'd item name against master Product records so we
 * can auto-link known products and flag unknown ones for verification.
 * Uses simple normalized token overlap — good enough as a first pass;
 * can be replaced with a vector-similarity search later.
 *
 * @param {string}   rawName   — Item name as extracted by OCR
 * @param {object[]} products  — Array of active Product records from the DB
 * @returns {{ product: object|null, score: number }}
 */
function matchProductName(rawName, products) {
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const target = normalize(rawName);
  const targetTokens = new Set(target.split(/\s+/).filter(Boolean));

  let best = null;
  let bestScore = 0;

  for (const p of products) {
    const candidate = normalize(p.name);
    if (candidate === target) return { product: p, score: 1 };

    const candidateTokens = new Set(candidate.split(/\s+/).filter(Boolean));
    const overlap = [...targetTokens].filter((t) => candidateTokens.has(t)).length;
    const score = overlap / Math.max(targetTokens.size, candidateTokens.size, 1);

    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  // Require a reasonably confident match, otherwise treat as unknown product.
  return bestScore >= 0.6 ? { product: best, score: bestScore } : { product: null, score: bestScore };
}

module.exports = { extractReceiptData, matchProductName, getOcrStatus };
