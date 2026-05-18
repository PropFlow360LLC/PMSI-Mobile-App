const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

function getVisionApiKey() {
  const key = process.env.GOOGLE_VISION_API_KEY;
  if (!key) {
    throw new Error('GOOGLE_VISION_API_KEY not configured');
  }
  return key;
}

/**
 * Google Cloud Vision TEXT_DETECTION (API key auth).
 */
export async function ocrImageBuffer(buffer) {
  const apiKey = getVisionApiKey();
  const url = `${VISION_URL}?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: [
        {
          image: { content: buffer.toString('base64') },
          features: [{ type: 'TEXT_DETECTION', maxResults: 1 }],
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || response.statusText;
    throw new Error(`Google Vision OCR failed: ${message}`);
  }

  const annotation = data.responses?.[0];
  if (annotation?.error?.message) {
    throw new Error(`Google Vision OCR failed: ${annotation.error.message}`);
  }

  return (
    annotation?.fullTextAnnotation?.text ||
    annotation?.textAnnotations?.[0]?.description ||
    ''
  );
}
