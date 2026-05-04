'use strict';

import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({});

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

const badRequest = (message) => ({
  statusCode: 400,
  headers: jsonHeaders,
  body: JSON.stringify({ success: false, message }),
});

const sanitizeFileName = (fileName) => {
  const cleaned = (fileName || 'image')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'image';
};

const buildPublicUrl = ({ bucket, region, key }) => {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  if (region === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
};

export const handler = async (event) => {
  if (!process.env.UPLOAD_BUCKET) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        message: 'UPLOAD_BUCKET is not configured.',
      }),
    };
  }

  let payload;

  try {
    payload = event.body ? JSON.parse(event.body) : {};
  } catch {
    return badRequest('Request body must be valid JSON.');
  }

  const fileName = payload?.fileName?.trim();
  const contentType = payload?.contentType?.trim();
  const folder = payload?.folder?.trim() || 'uploads';

  if (!fileName) {
    return badRequest('Provide a "fileName" value.');
  }

  if (!contentType) {
    return badRequest('Provide a "contentType" value.');
  }

  if (!contentType.startsWith('image/')) {
    return badRequest('"contentType" must be an image MIME type.');
  }

  const safeFolder = folder.replace(/^\/+|\/+$/g, '') || 'uploads';
  const key = `${safeFolder}/${Date.now()}-${randomUUID()}-${sanitizeFileName(fileName)}`;

  try {
    const command = new PutObjectCommand({
      Bucket: process.env.UPLOAD_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    const publicUrl = buildPublicUrl({
      bucket: process.env.UPLOAD_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      key,
    });

    return {
      statusCode: 200,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: true,
        uploadUrl,
        publicUrl,
        key,
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        expiresIn: 300,
        note: 'Upload the raw image bytes to uploadUrl using PUT. The publicUrl will only work if the bucket/object is publicly readable.',
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({
        success: false,
        message: error?.message || 'Could not generate presigned URL.',
      }),
    };
  }
};
