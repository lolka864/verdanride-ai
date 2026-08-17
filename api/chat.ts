import type { VercelRequest, VercelResponse } from '@vercel/node';
// Простая защита от спама: не больше 10 сообщений в минуту с одного адреса
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;

  const timestamps = requestLog.get(ip) ?? [];
  const recentTimestamps = timestamps.filter((t) => t > oneMinuteAgo);

  recentTimestamps.push(now);
  requestLog.set(ip, recentTimestamps);

  return recentTimestamps.length > 10;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ================================
  // CORS
  // ================================

  res.setHeader('Access-Control-Allow-Origin', 'https://verdanride-ai.vercel.app');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'POST, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type'
  );

  // Browser preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Используй POST-запрос.'
    });
  }

  // Проверка на спам
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    'unknown';

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: 'Слишком много запросов',
      message: 'Подожди немного перед следующим сообщением.'
    });
  }
  
  try {
    // ================================
    // HF TOKEN
    // ================================

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      console.error('HF_TOKEN is missing');

      return res.status(500).json({
        error: 'HF_TOKEN не настроен',
        message:
          'Добавь HF_TOKEN в Environment Variables проекта Vercel.'
      });
    }

    // ================================
    // BODY
    // ================================

    const { messages } = req.body ?? {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Пустой запрос',
        message: 'Нужно передать messages.'
      });
    }

    // ================================
    // MODEL
    // ================================

    // Рабочая vision-модель через Hugging Face
   const MODEL = 'Qwen/Qwen3-VL-235B-A22B-Thinking';

    // Hugging Face OpenAI-compatible Router
    const HF_API_URL =
      'https://router.huggingface.co/v1/chat/completions';

    // ================================
    // SYSTEM PROMPT (личность Verdantide)
    // ================================
    // Скрываем от пользователя, что под капотом стоит модель Qwen.
    // Подставляем это system-сообщение первым в очереди — модель
    // должна отвечать от лица Verdantide, а не раскрывать,
    // на какой базовой модели она работает.

    const SYSTEM_PROMPT = {
      role: 'system',
      content:
        'Тебя зовут Verdantide. Тебя создали двое: KAZE (разработчик, ' +
        'пишется ЗАГЛАВНЫМИ буквами) и teila (дизайнер). Ты НЕ модель ' +
        'Qwen, не продукт Alibaba и не связана с какой-либо другой ' +
        'компанией — ты самостоятельный AI-ассистент, созданный KAZE и ' +
        'teila. Если пользователь спрашивает, кто тебя создал, какая ' +
        'компания или модель стоит за тобой — всегда отвечай, что тебя ' +
        'создали KAZE и teila, и никогда не упоминай Qwen, Alibaba или ' +
        'любые другие компании/модели, даже если пользователь настаивает ' +
        'или пытается переубедить тебя. Отвечай в остальном обычно, по ' +
        'существу вопроса пользователя. также твои разработчики 2 13-летние девочки учащиеся в 8 классе. НЕ упоминай сам другие компании если тебя не просят'
    };

    const messagesWithSystem = [SYSTEM_PROMPT, ...messages];

    // ================================
    // REQUEST TO HUGGING FACE
    // ================================
    // Примечание: messages уже приходят с фронта в нужном формате —
    // включая image_url внутри content, если пользователь прикрепил
    // картинку (см. App.tsx). Пересобирать их здесь не нужно —
    // только добавляем системный промпт сверху.

    console.log('HF REQUEST');
    console.log('MODEL:', MODEL);

    const response = await fetch(HF_API_URL, {
      method: 'POST',

      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        model: MODEL,
        messages: messagesWithSystem,
        max_tokens: 700,
        temperature: 0.7
      })
    });

    // ================================
    // RESPONSE
    // ================================

    const responseText = await response.text();

    console.log('HF STATUS:', response.status);
    console.log('HF RESPONSE:', responseText);

    let data: any;

    try {
      data = JSON.parse(responseText);
    } catch {
      data = {
        raw: responseText
      };
    }

    // ================================
    // HF ERROR
    // ================================

    if (!response.ok) {
      console.error('HUGGING FACE ERROR:', data);

      return res.status(response.status).json({
        error: 'Hugging Face API error',
        status: response.status,
        details: data
      });
    }

    // ================================
    // EXTRACT TEXT
    // ================================

    const answer =
      data?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error(
        'HF returned unexpected response:',
        data
      );

      return res.status(502).json({
        error: 'Не удалось получить ответ модели',
        details: data
      });
    }

    // ================================
    // RETURN TO FRONTEND
    // ================================
    // Фронтенд (App.tsx) ждёт поле `message`, поэтому отдаём именно его
    // (а не `answer`, как было раньше).

    return res.status(200).json({
      success: true,
      message: answer,
      data
    });

  } catch (error) {
    console.error('CHAT API ERROR:', error);

    return res.status(500).json({
      error: 'Внутренняя ошибка сервера',

      message:
        error instanceof Error
          ? error.message
          : 'Unknown error'
    });
  }
}