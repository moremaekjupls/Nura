/**
 * Meal recognition via Google Gemini: a photo or a free-text description
 * ("самса и чай с сахаром") → a list of items with estimated nutrition.
 */

export interface AiItem {
  name: string;
  portion: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface AiResult {
  items: AiItem[];
  confidence: 'high' | 'medium' | 'low';
  note: string;
}

export class AiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const MODEL = 'gemini-2.5-flash';

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          portion: { type: 'STRING' },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
        },
        required: ['name', 'portion', 'calories', 'protein', 'fat', 'carbs'],
      },
    },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    note: { type: 'STRING' },
  },
  required: ['items', 'confidence', 'note'],
};

function instructions(lang: 'ru' | 'uz', source: 'photo' | 'text'): string {
  const language = lang === 'uz' ? 'узбекском (латиница)' : 'русском';
  const task =
    source === 'photo'
      ? 'Определи блюда и напитки на фото и оцени порцию, видимую на снимке.'
      : 'Пользователь описал словами, что съел. Разбери описание на отдельные блюда и напитки. Если порция не указана — бери стандартную порцию для Узбекистана.';
  return (
    `Ты нутрициолог, хорошо знающий узбекскую и среднеазиатскую кухню. ${task} ` +
    'Для каждой позиции дай калории и БЖУ в граммах на указанную порцию. ' +
    `Названия и пояснение пиши на ${language} языке, коротко. Порцию указывай как «350 г», «1 шт», «250 мл». ` +
    'Если на фото/в тексте нет еды — верни пустой список items и объясни в note.'
  );
}

function clamp(n: unknown, max: number): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v * 10) / 10)) : 0;
}

export function sanitize(raw: unknown): AiResult {
  const r = (raw ?? {}) as Partial<AiResult>;
  const items = (Array.isArray(r.items) ? r.items : [])
    .slice(0, 10)
    .filter((i) => i && typeof i.name === 'string' && i.name.trim())
    .map((i) => ({
      name: String(i.name).trim().slice(0, 120),
      portion: String(i.portion ?? '').trim().slice(0, 60),
      calories: Math.round(clamp(i.calories, 5000)),
      protein: clamp(i.protein, 500),
      fat: clamp(i.fat, 500),
      carbs: clamp(i.carbs, 1000),
    }));
  const confidence = r.confidence === 'high' || r.confidence === 'low' ? r.confidence : 'medium';
  return { items, confidence, note: String(r.note ?? '').slice(0, 300) };
}

export async function recognize(
  apiKey: string,
  input: { kind: 'photo'; image: string; mediaType: string } | { kind: 'text'; text: string },
  lang: 'ru' | 'uz',
): Promise<AiResult> {
  const parts =
    input.kind === 'photo'
      ? [{ inline_data: { mime_type: input.mediaType, data: input.image } }, { text: instructions(lang, 'photo') }]
      : [{ text: `${instructions(lang, 'text')}\n\nОписание: «${input.text}»` }];

  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 1024,
          temperature: 0.2,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error('[ai] request failed:', err);
    throw new AiError(504, 'ИИ не ответил вовремя. Попробуйте ещё раз');
  }

  if (!res.ok) {
    console.error('[ai] Gemini error', res.status, (await res.text()).slice(0, 500));
    throw new AiError(502, 'Сервис распознавания сейчас недоступен');
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) throw new AiError(502, 'ИИ вернул пустой ответ');
  try {
    return sanitize(JSON.parse(text));
  } catch {
    console.error('[ai] unparseable response:', text.slice(0, 500));
    throw new AiError(502, 'Не удалось разобрать ответ ИИ');
  }
}
