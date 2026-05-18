import { extractTextFromBuffer } from './documentText.js';

const OPENAI_API = 'https://api.openai.com/v1/chat/completions';

const IMAGE_PROMPT =
  'Extract the property address and optional unit/apartment from this image. Return JSON only: {"address":"123 Main St","unit":"2b"}. Use null for missing unit. If no address found, return {"address":null,"unit":null}. Address should be house number and street only (no city, state, zip).';

const TEXT_PROMPT_PREFIX =
  'Extract the property address and optional unit/apartment from this document text. Return JSON only: {"address":"123 Main St","unit":"2b"}. Use null for missing values. Address should be house number and street only (no city, state, zip). If no address found, return {"address":null,"unit":null}.\n\nDocument text:\n';

function parseExtractResult(raw) {
  if (!raw) return { address: null, unit: null };

  try {
    const parsed = JSON.parse(raw);
    const address = parsed.address;
    const unit = parsed.unit;
    if (!address || address === 'NOT_FOUND') {
      return { address: null, unit: unit && unit !== 'null' ? unit : null };
    }
    return {
      address: String(address).trim(),
      unit: unit && unit !== 'null' ? String(unit).trim() : null,
    };
  } catch {
    const text = raw.trim();
    if (text === 'NOT_FOUND' || !text) return { address: null, unit: null };
    return { address: text, unit: null };
  }
}

async function callOpenAI(messages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const response = await fetch(OPENAI_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 120,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI request failed: ${detail}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}

export async function extractAddressFromImage(base64, mimeType) {
  const raw = await callOpenAI([
    {
      role: 'user',
      content: [
        { type: 'text', text: IMAGE_PROMPT },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'low' },
        },
      ],
    },
  ]);
  return parseExtractResult(raw);
}

export async function extractAddressFromText(text) {
  if (!text?.trim()) return { address: null, unit: null };

  const raw = await callOpenAI([
    {
      role: 'user',
      content: TEXT_PROMPT_PREFIX + text,
    },
  ]);
  return parseExtractResult(raw);
}

export async function extractAddressFromDocumentBuffer(buffer, mimeType, fileName) {
  const text = await extractTextFromBuffer(buffer, mimeType, fileName);
  if (!text) {
    return { address: null, unit: null };
  }
  return extractAddressFromText(text);
}

export async function handleExtractAddress(req, res) {
  try {
    if (req.file) {
      const { buffer, mimetype, originalname } = req.file;

      if (mimetype.startsWith('image/')) {
        const base64 = buffer.toString('base64');
        const result = await extractAddressFromImage(base64, mimetype);
        return res.json(result);
      }

      if (
        mimetype === 'application/pdf' ||
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        originalname.match(/\.(pdf|docx?)$/i)
      ) {
        const result = await extractAddressFromDocumentBuffer(buffer, mimetype, originalname);
        return res.json(result);
      }

      return res.status(400).json({
        error: 'Unsupported file type. Use image, PDF, or Word (.doc/.docx).',
      });
    }

    const { image, mimeType } = req.body || {};
    if (image && mimeType) {
      if (!mimeType.startsWith('image/')) {
        return res.status(400).json({ error: 'JSON body only supports images' });
      }
      const result = await extractAddressFromImage(image, mimeType);
      return res.json(result);
    }

    return res.status(400).json({ error: 'No file or image provided' });
  } catch (err) {
    console.error('Extract address error:', err);
    return res.status(500).json({ error: err.message || 'Failed to extract address' });
  }
}
