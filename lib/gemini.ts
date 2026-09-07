import { OcrResult } from './types';

const OCR_PROMPT = `You are reading a photo of a handwritten "Computer Lab Ledger" sheet from an
Indian college. The sheet has a header with Date, Section, Class, and Faculty
Name, followed by a table with columns: SL.NO, NAME, UUCMS NO. (or UCMS NO.), SYSTEM NO.,
SIGN, REMARKS. Some rows may be blank (unused) — skip those. The REMARKS
column may be empty for most students — that's normal, leave it null.

Extract and return ONLY valid JSON, no other text, in this exact shape:

{
  "header": {
    "date": "string or null",
    "section": "string or null",
    "class": "string or null",
    "faculty_name": "string or null",
    "total_system_count": "number or null",
    "total_mouse_count": "number or null",
    "total_keyboard_count": "number or null"
  },
  "rows": [
    {
      "sl_no": number,
      "name": "string as best read",
      "ucms_no": "string as best read (UUCMS number)",
      "system_no": "string as best read",
      "signature_present": true or false,
      "remarks": "string or null"
    }
  ]
}

Rules:
- Only include rows that have at least a name written in them.
- If a field is illegible, transcribe your closest reading.
- Do not invent rows that aren't on the page.
- Preserve the exact SL.NO printed in that row.`;

const FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
];

export async function extractLedgerData(
  photoBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<OcrResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  let lastError: unknown = null;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: photoBase64,
                    },
                  },
                  { text: OCR_PROMPT },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson?.error?.message || `HTTP ${res.status}: ${res.statusText}`
        );
      }

      const resJson = await res.json();
      const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        throw new Error('No content returned in response');
      }

      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = text.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const braceStart = jsonStr.indexOf('{');
        const braceEnd = jsonStr.lastIndexOf('}');
        if (braceStart !== -1 && braceEnd !== -1) {
          jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
        }
      }

      const parsed = JSON.parse(jsonStr) as OcrResult;
      if (!parsed.header || !Array.isArray(parsed.rows)) {
        throw new Error('Invalid OCR response structure');
      }
      return parsed;
    } catch (err) {
      console.warn(`Model ${modelName} encountered error, trying next fallback...`, err);
      lastError = err;
    }
  }

  throw new Error(
    `OCR extraction failed across all models. Last error: ${
      lastError instanceof Error ? lastError.message : 'Unknown error'
    }`
  );
}

