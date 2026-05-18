const STREET_SUFFIX =
  '(?:St|Street|Ave|Avenue|Rd|Road|Dr|Drive|Ln|Lane|Blvd|Boulevard|Ct|Court|Way|Pl|Place|Cir|Circle|Ter|Terrace|Trl|Trail|Pkwy|Parkway|Hwy|Highway)';

const STREET_LINE_RE = new RegExp(
  `^(\\d{1,6}[\\w\\-]*\\s+(?:[NSEW]\\.)?\\s*[A-Za-z0-9'\\.\\-]+(?:\\s+[A-Za-z0-9'\\.\\-]+){0,4}\\s+${STREET_SUFFIX})\\b\\.?`,
  'i'
);

const STREET_INLINE_RE = new RegExp(
  `\\b(\\d{1,6}[\\w\\-]*\\s+(?:[NSEW]\\.)?\\s*[A-Za-z0-9'\\.\\-]+(?:\\s+[A-Za-z0-9'\\.\\-]+){0,4}\\s+${STREET_SUFFIX})\\b`,
  'i'
);

const LABEL_RE =
  /(?:property|service|job\s*site|work\s*site|service\s*location|location|site|address\s*of\s*service)\s*(?:address|location)?\s*[:\-#]?\s*(.+)$/i;

const UNIT_RE =
  /\b(?:unit|apt|apartment|suite|ste|bldg|building|#)\s*#?\s*([A-Za-z0-9\-]+)\b/i;

const CITY_STATE_ZIP_RE =
  /,?\s*[A-Za-z][A-Za-z\s.'-]+,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?.*$/i;

function normalizeWhitespace(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function stripCityStateZip(line) {
  return line.replace(CITY_STATE_ZIP_RE, '').replace(/\s+,/g, ',').replace(/,\s*$/, '').trim();
}

function extractUnit(line) {
  const match = line.match(UNIT_RE);
  if (!match) return { unit: null, rest: line };
  const unit = match[1].trim();
  const rest = line.replace(UNIT_RE, ' ').replace(/\s+/g, ' ').trim();
  return { unit, rest };
}

function matchStreet(line) {
  const cleaned = stripCityStateZip(line);
  const lineMatch = cleaned.match(STREET_LINE_RE);
  if (lineMatch) return lineMatch[1].trim();
  const inlineMatch = cleaned.match(STREET_INLINE_RE);
  if (inlineMatch) return inlineMatch[1].trim();
  return null;
}

function parseLine(line, confidence = 'high') {
  const { unit, rest } = extractUnit(line);
  const address = matchStreet(rest);
  if (!address) return null;
  return { address, unit, confidence };
}

/**
 * Deterministic address + unit parser for OCR / document text.
 * Tuned for maintenance invoices, work orders, notices, and screenshots.
 */
export function parseAddressFromText(text) {
  if (!text?.trim()) {
    return { address: null, unit: null, confidence: 'low' };
  }

  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const lines = [...rawLines];
  const joined = normalizeWhitespace(text);

  // Label-led lines (high confidence)
  for (const line of lines) {
    const labelMatch = line.match(LABEL_RE);
    if (labelMatch) {
      const parsed = parseLine(labelMatch[1], 'high');
      if (parsed) return parsed;
    }
  }

  // Multi-line: label on one line, address on next
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/address|location|property|service\s*site|job\s*site/i.test(lines[i])) {
      const next = lines[i + 1];
      const parsed = parseLine(next, 'high');
      if (parsed) return parsed;
    }
  }

  // Any line that looks like a street address
  for (const line of lines) {
    const parsed = parseLine(line, 'medium');
    if (parsed) return { ...parsed, confidence: 'medium' };
  }

  // Inline anywhere (screenshots / cramped layouts)
  const inline = joined.match(STREET_INLINE_RE);
  if (inline) {
    const { unit, rest } = extractUnit(joined);
    const address = matchStreet(rest) || inline[1].trim();
    return {
      address,
      unit: unit || null,
      confidence: 'low',
    };
  }

  return { address: null, unit: null, confidence: 'low' };
}
