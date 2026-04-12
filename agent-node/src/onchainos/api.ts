import crypto from 'crypto';
import querystring from 'querystring';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('OnchainOSAPI');

function preHash(timestamp: string, method: string, request_path: string, params?: Record<string, any>) {
  let query_string = '';
  if (method === 'GET' && params) {
    query_string = '?' + querystring.stringify(params);
  }
  if (method === 'POST' && params) {
    query_string = JSON.stringify(params);
  }
  return timestamp + method + request_path + query_string;
}

function sign(message: string, secret_key: string) {
  const hmac = crypto.createHmac('sha256', secret_key);
  hmac.update(message);
  return hmac.digest('base64');
}

function createSignature(method: string, request_path: string, params?: Record<string, any>) {
  const timestamp = new Date().toISOString().slice(0, -5) + 'Z';
  const apiKey = process.env.OKX_API_KEY || '';
  const secretKey = process.env.OKX_SECRET_KEY || '';
  const passphrase = process.env.OKX_PASSPHRASE || '';

  const message = preHash(timestamp, method, request_path, params);
  const signature = sign(message, secretKey);

  return { signature, timestamp, apiKey, passphrase };
}

export async function sendGetRequest(request_path: string, params?: Record<string, any>) {
  const { signature, timestamp, apiKey, passphrase } = createSignature('GET', request_path, params);

  const headers = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
  };

  const url = `https://web3.okx.com${request_path}` + (params ? `?${querystring.stringify(params)}` : '');
  
  logger.debug(`[GET] ${url}`);
  
  const response = await fetch(url, { method: 'GET', headers });
  
  if (!response.ok) {
    throw new Error(`OnchainOS API GET Error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

export async function sendPostRequest(request_path: string, params?: Record<string, any>) {
  const { signature, timestamp, apiKey, passphrase } = createSignature('POST', request_path, params);

  const headers = {
    'OK-ACCESS-KEY': apiKey,
    'OK-ACCESS-SIGN': signature,
    'OK-ACCESS-TIMESTAMP': timestamp,
    'OK-ACCESS-PASSPHRASE': passphrase,
    'Content-Type': 'application/json',
  };

  const url = `https://web3.okx.com${request_path}`;
  
  logger.debug(`[POST] ${url}`);
  
  const response = await fetch(url, { 
    method: 'POST', 
    headers,
    body: params ? JSON.stringify(params) : undefined
  });

  if (!response.ok) {
    throw new Error(`OnchainOS API POST Error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
