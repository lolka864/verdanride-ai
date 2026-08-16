import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages' });
    }

    const response = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openrouter/free',
          messages: [
            {
              role: 'system',
              content:
                'You are Verdantide, a helpful, intelligent and friendly AI assistant inspired by nature. You are a general-purpose assistant. Answer naturally and accurately. Help with studying, programming, creativity, science, everyday questions, nature, animals and ecology. Maintain conversation context. Respond in the same language as the user.',
            },
            ...messages,
          ],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'AI request failed',
      });
    }

    return res.status(200).json({
      message: data.choices?.[0]?.message?.content || 'Пустой ответ от AI.',
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'Ошибка соединения с AI',
    });
  }
}