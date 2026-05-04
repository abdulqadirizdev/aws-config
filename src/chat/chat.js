'use strict';

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const badRequest = (message) => ({
  statusCode: 400,
  headers: jsonHeaders,
  body: JSON.stringify({ success: false, message }),
});

const extractReplyText = (data) => {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts = data?.output
    ?.flatMap((item) => item?.content || [])
    ?.filter((item) => item?.type === 'output_text')
    ?.map((item) => item?.text || '')
    ?.filter(Boolean);

  return parts?.join('\n').trim() || '';
};

export const handler = async (event) => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        message: 'OPENAI_API_KEY is not configured.',
      }),
    };
  }

  let payload;

  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const text = payload?.text?.trim();
  const imageUrl = payload?.imageUrl?.trim();
  const model = payload?.model?.trim() || 'gpt-4.1-mini';

  if (!text && !imageUrl) {
    return badRequest('Provide at least one of "text" or "imageUrl".');
  }

  if (imageUrl) {
    try {
      new URL(imageUrl);
    } catch {
      return badRequest('"imageUrl" must be a valid public URL.');
    }
  }

  const input = [];

  if (text) {
    input.push({
      role: 'user',
      content: [{ type: 'input_text', text }],
    });
  }

  if (imageUrl) {
    if (!text) {
      input.push({
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: 'Please describe or answer based on this image.',
          },
        ],
      });
    }

    input[input.length - 1].content.push({
      type: 'input_image',
      image_url: imageUrl,
    });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error?.message || 'OpenAI request failed.');
    }

    const reply = extractReplyText(data);

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        reply,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        message: error?.message || 'OpenAI request failed.',
      }),
    };
  }
};
