import { extractTextFromBuffer } from './documentText.js';
import { ocrImageBuffer } from './googleVision.js';
import { parseAddressFromText } from './parseAddress.js';

export async function extractAddressFromImageBuffer(buffer) {
  const ocrText = await ocrImageBuffer(buffer);
  return parseAddressFromText(ocrText);
}

export async function extractAddressFromDocumentBuffer(buffer, mimeType, fileName) {
  const text = await extractTextFromBuffer(buffer, mimeType, fileName);
  return parseAddressFromText(text);
}

export async function handleExtractAddress(req, res) {
  try {
    if (req.file) {
      const { buffer, mimetype, originalname } = req.file;

      if (mimetype.startsWith('image/')) {
        const result = await extractAddressFromImageBuffer(buffer);
        return res.json({
          address: result.address,
          unit: result.unit,
          confidence: result.confidence,
        });
      }

      if (
        mimetype === 'application/pdf' ||
        mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimetype === 'application/msword' ||
        originalname.match(/\.(pdf|docx?)$/i)
      ) {
        const result = await extractAddressFromDocumentBuffer(buffer, mimetype, originalname);
        return res.json({
          address: result.address,
          unit: result.unit,
          confidence: result.confidence,
        });
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
      const buffer = Buffer.from(image, 'base64');
      const result = await extractAddressFromImageBuffer(buffer);
      return res.json({
        address: result.address,
        unit: result.unit,
        confidence: result.confidence,
      });
    }

    return res.status(400).json({ error: 'No file or image provided' });
  } catch (err) {
    console.error('Extract address error:', err);
    return res.status(500).json({ error: err.message || 'Failed to extract address' });
  }
}
