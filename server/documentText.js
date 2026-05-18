import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';

const MAX_TEXT_LENGTH = 12000;

export function truncateText(text) {
  if (!text) return '';
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > MAX_TEXT_LENGTH ? cleaned.slice(0, MAX_TEXT_LENGTH) : cleaned;
}

export async function extractTextFromPdf(buffer) {
  const data = await pdf(buffer);
  return truncateText(data.text);
}

export async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return truncateText(result.value);
}

export async function extractTextFromDoc(buffer) {
  const extractor = new WordExtractor();
  const doc = await extractor.extract(buffer);
  return truncateText(doc.getBody());
}

export async function extractTextFromBuffer(buffer, mimeType, fileName = '') {
  const lowerName = fileName.toLowerCase();

  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return extractTextFromPdf(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lowerName.endsWith('.docx')
  ) {
    return extractTextFromDocx(buffer);
  }

  if (mimeType === 'application/msword' || lowerName.endsWith('.doc')) {
    return extractTextFromDoc(buffer);
  }

  throw new Error(`Unsupported document type: ${mimeType || fileName}`);
}
