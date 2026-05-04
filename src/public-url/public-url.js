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

export const handler = async (event) => {
  let payload;

  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const inputUrl = payload?.url?.trim();

  if (!inputUrl) {
    return badRequest('Provide a "url" value.');
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(inputUrl);
  } catch {
    return badRequest('"url" must be a valid URL.');
  }

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      success: true,
      publicUrl: `${parsedUrl.origin}${parsedUrl.pathname}`,
      note: 'This removes the presigned query string. The object must already be publicly accessible for this URL to work.',
    }),
  };
};
