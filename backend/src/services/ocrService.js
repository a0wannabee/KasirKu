const fs = require('fs');

/**
 * Extracts structured line items (name, quantity, unit, price) from a photo
 * of a supplier receipt ("nota").
 *
 * Uses a vision-capable LLM (Claude) to do OCR + structured extraction in a
 * single pass, which handles messy handwriting / non-standard layouts far
 * better than classic OCR + regex. The model is instructed to return ONLY
 * JSON — no markdown fences, no commentary — and the result is validated
 * before use (never trust model output blindly).
 *
 * Swap-in note: if you prefer a classic OCR pipeline (Tesseract) plus a
 * separate NLP extraction step, implement the same function signature here
 * so callers (purchaseController) never need to change.
 */
async function extractReceiptData(imagePath, mimeType = 'image/jpeg') {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');

  const systemPrompt = `Kamu adalah sistem ekstraksi data nota belanja untuk toko retail/grosir.
Baca foto nota supplier dan kembalikan HANYA JSON valid (tanpa markdown, tanpa penjelasan) dengan struktur:
{
  "supplierName": string | null,
  "receiptDate": string | null,
  "items": [
    { "rawName": string, "quantity": number, "unit": string, "unitPrice": number, "subtotal": number }
  ],
  "totalAmount": number | null,
  "confidence": number // 0-1, seberapa yakin kamu terhadap hasil ekstraksi ini
}
Jika ada bagian yang tidak terbaca jelas, tetap sertakan item dengan confidence lebih rendah.
Jangan mengarang angka yang tidak terlihat di gambar.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
            { type: 'text', text: 'Ekstrak data dari nota ini menjadi JSON sesuai format yang ditentukan.' },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OCR provider error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const textBlock = data.content.find((c) => c.type === 'text');
  if (!textBlock) throw new Error('Model tidak mengembalikan hasil teks.');

  let parsed;
  try {
    const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('Gagal mem-parsing hasil OCR menjadi JSON. Perlu verifikasi manual.');
  }

  // Defensive validation — never trust the model's shape blindly.
  if (!Array.isArray(parsed.items)) parsed.items = [];
  parsed.items = parsed.items
    .filter((it) => it && it.rawName)
    .map((it) => ({
      rawName: String(it.rawName).trim(),
      quantity: Number(it.quantity) || 0,
      unit: String(it.unit || '').trim(),
      unitPrice: Number(it.unitPrice) || 0,
      subtotal: Number(it.subtotal) || Number(it.quantity || 0) * Number(it.unitPrice || 0),
    }));

  return {
    supplierName: parsed.supplierName || null,
    receiptDate: parsed.receiptDate || null,
    items: parsed.items,
    totalAmount: Number(parsed.totalAmount) || parsed.items.reduce((sum, i) => sum + i.subtotal, 0),
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    rawText: textBlock.text,
  };
}

/**
 * Fuzzy-matches an OCR'd item name against master Product records so we
 * can auto-link known products and flag unknown ones for verification.
 * Uses simple normalized token overlap — good enough as a first pass;
 * can be replaced with a vector-similarity search later.
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

module.exports = { extractReceiptData, matchProductName };
