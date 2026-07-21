/**
 * Shared types and validation helpers for the OCR provider abstraction.
 *
 * All providers must return an object that matches OcrResult.
 * This module also exports the defensive normalizer so every provider
 * implementation shares the same validation logic.
 */

/**
 * @typedef {Object} OcrItem
 * @property {string}  rawName    — Item name as read from the receipt
 * @property {number}  quantity   — Quantity (may be 0 if unreadable)
 * @property {string}  unit       — Unit string (e.g. "pcs", "karton", "kg")
 * @property {number}  unitPrice  — Price per unit (may be 0 if unreadable)
 * @property {number}  subtotal   — Line total (falls back to qty * price)
 */

/**
 * @typedef {Object} OcrResult
 * @property {string|null}  supplierName  — Supplier name extracted from receipt
 * @property {string|null}  receiptDate   — Date string from receipt (ISO or raw)
 * @property {OcrItem[]}    items         — Line items extracted
 * @property {number}       totalAmount   — Grand total (falls back to sum of items)
 * @property {number}       confidence    — 0–1 confidence score from the provider
 * @property {string}       rawText       — Raw text / JSON returned by the provider
 */

/**
 * Validates and normalizes a raw object into a guaranteed-safe OcrResult.
 * Throws if `parsed` is not an object.
 *
 * @param   {unknown} parsed   — Object parsed from provider response
 * @param   {string}  rawText  — Raw text string to preserve
 * @returns {OcrResult}
 */
function normalizeOcrResult(parsed, rawText) {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Provider returned non-object response.');
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items = rawItems
    .filter((it) => it && it.rawName)
    .map((it) => ({
      rawName:   String(it.rawName).trim(),
      quantity:  Number(it.quantity) || 0,
      unit:      String(it.unit || '').trim(),
      unitPrice: Number(it.unitPrice) || 0,
      subtotal:  Number(it.subtotal) || Number(it.quantity || 0) * Number(it.unitPrice || 0),
      category:  it.category ? String(it.category).trim() : null,
      brand:     it.brand ? String(it.brand).trim() : null,
      barcode:   it.barcode ? String(it.barcode).trim() : null,
    }));

  const totalAmount =
    Number(parsed.totalAmount) ||
    items.reduce((sum, i) => sum + i.subtotal, 0);

  return {
    supplierName: parsed.supplierName || null,
    receiptDate:  parsed.receiptDate  || null,
    items,
    totalAmount,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    rawText,
  };
}

/**
 * Parse a raw text string that should contain JSON.
 * Strips markdown code fences before parsing.
 *
 * @param   {string} text
 * @returns {unknown}
 * @throws  if JSON.parse fails
 */
function parseJsonResponse(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * The system prompt used by every AI provider.
 * Defined once here so all providers produce the same output schema.
 */
const SYSTEM_PROMPT = `Kamu adalah sistem ekstraksi data nota belanja untuk toko retail/grosir Indonesia.
Baca foto nota supplier dan kembalikan HANYA JSON valid (tanpa markdown, tanpa penjelasan) dengan struktur:
{
  "supplierName": string | null,
  "receiptDate": string | null,
  "items": [
    { 
      "rawName": string, 
      "quantity": number, 
      "unit": string, 
      "unitPrice": number, 
      "subtotal": number,
      "category": string | null,
      "brand": string | null,
      "barcode": string | null
    }
  ],
  "totalAmount": number | null,
  "confidence": number
}
Aturan:
- confidence adalah 0.0 sampai 1.0, seberapa yakin kamu terhadap hasil ekstraksi.
- Jika ada bagian yang tidak terbaca, tetap sertakan item dengan data yang tersedia.
- Jangan mengarang angka yang tidak terlihat di gambar.
- Harga dalam Rupiah (IDR), jangan tambahkan simbol mata uang.
- Prediksikan "category" (kategori produk seperti "Makanan", "Minuman", "Sabun", "Sembako", "Obat", dll), "brand" (merk produk), dan "barcode" jika tertera jelas di sebelah nama produk.`;

const USER_PROMPT = 'Ekstrak data dari nota ini menjadi JSON sesuai format yang ditentukan.';

module.exports = { normalizeOcrResult, parseJsonResponse, SYSTEM_PROMPT, USER_PROMPT };
