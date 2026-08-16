import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // ================================
  // CORS
  // ================================

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Browser preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Используй POST-запрос.',
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
        message: 'Добавь HF_TOKEN в Environment Variables проекта Vercel.',
      });
    }

    // ================================
    // BODY
    // ================================

    const { messages } = req.body ?? {};

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: 'Пустой запрос',
        message: 'Нужно передать messages.',
      });
    }

    // ================================
    // MODEL
    // ================================

    // Рабочая vision-модель через Hugging Face (провайдер Z.ai)
    const MODEL = 'zai-org/GLM-4.6V-Flash:zai-org';

    // Hugging Face OpenAI-compatible Router
    const HF_API_URL = 'https://router.huggingface.co/v1/chat/completions';

    // ================================
    // REQUEST TO HUGGING FACE
    // ================================
    //
    // Фронтенд (App.tsx) уже присылает messages в готовом
    // OpenAI-совместимом формате: для текстовых сообщений
    // content — строка, для сообщений с картинкой —
    // массив [{ type: 'text', ... }, { type: 'image_url', ... }].
    // Никакой доп. сборки content/text/imageUrl тут не нужно —
    // именно попытка читать несуществующие userMessage/imageUrl
    // и роняла функцию с 500 на каждом запросе.

    const hasImage = messages.some(
      (m: any) => Array.isArray(m?.content) && m.content.some((c: any) => c?.type === 'image_url')
    );

    console.log('HF REQUEST');
    console.log('MODEL:', MODEL);
    console.log('HAS IMAGE:', hasImage);

    // Добавляем системную инструкцию первым сообщением, чтобы
    // модель всегда отвечала по-русски — независимо от языка
    // картинки или того, на каком языке написано сообщение.
    const messagesWithSystemPrompt = [
      {
        role: 'system',
        content:
          'Ты — Verdantide, дружелюбный ассистент. Всегда отвечай ТОЛЬКО на русском языке, ' +
          'даже если пользователь написал на другом языке или на изображении есть иностранный текст. ' +
          'Никогда не переключайся на другой язык.',
      },
      ...messages,
    ];

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messagesWithSystemPrompt,
        max_tokens: 700,
        temperature: 0.7,
      }),
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
      data = { raw: responseText };
    }

    // ================================
    // HF ERROR
    // ================================

    if (!response.ok) {
      console.error('HUGGING FACE ERROR:', data);

      return res.status(response.status).json({
        error: 'Hugging Face API error',
        status: response.status,
        details: data,
      });
    }

    // ================================
    // EXTRACT TEXT
    // ================================

    const answer = data?.choices?.[0]?.message?.content;

    if (!answer) {
      console.error('HF returned unexpected response:', data);

      return res.status(502).json({
        error: 'Не удалось получить ответ модели',
        details: data,
      });
    }

    // ================================
    // RETURN TO FRONTEND
    // ================================
    //
    // App.tsx читает data.message — раньше бэкенд отдавал только
    // answer, из-за чего фронт не мог показать даже успешный ответ.
    // Отдаём оба поля для совместимости.

    return res.status(200).json({
      success: true,
      message: answer,
      answer,
      data,
    });
  } catch (error) {
    console.error('CHAT API ERROR:', error);

    return res.status(500).json({
      error: 'Внутренняя ошибка сервера',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
