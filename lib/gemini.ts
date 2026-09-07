import { OcrResult } from './types';

const OCR_PROMPT = `You are an expert OCR system for handwritten Indian college Computer Lab Ledgers.
Extract header (date, section, class, faculty_name, total_system_count, total_mouse_count, total_keyboard_count) and student rows.
For each row extract:
- sl_no (number as printed/written)
- name (student name)
- ucms_no (UUCMS / roll number)
- system_no (computer/system number)
- signature_present (true if signature or tick mark is present, false otherwise)
- remarks (string or null)

Skip completely blank unused rows. Only include rows with a student name.
Preserve exact serial numbers (SL.NO).

Output strict, compact JSON in this structure:
{"header":{"date":null,"section":null,"class":null,"faculty_name":null,"total_system_count":null,"total_mouse_count":null,"total_keyboard_count":null},"rows":[{"sl_no":1,"name":"","ucms_no":"","system_no":"","signature_present":true,"remarks":null}]}`;

const FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
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
      const timeoutId = setTimeout(() => controller.abort(), 48000);

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
              temperature: 0.1,
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

