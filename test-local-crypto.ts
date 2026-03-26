import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

const utils = {
  toBuf: (s: string) => {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    const padded = pad ? b64 + '='.repeat(4 - pad) : b64;
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  },
  fromBuf: (b: Uint8Array) => btoa(String.fromCharCode(...Array.from(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
};

async function encryptPayload(sub: any, payload: string) {
  const encoder = new TextEncoder();
  const p256dh = utils.toBuf(sub.keys.p256dh);
  const auth = utils.toBuf(sub.keys.auth);

  const localKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPub = new Uint8Array(await crypto.subtle.exportKey('raw', localKeys.publicKey));
  const remotePub = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: remotePub }, localKeys.privateKey, 256);

  const authInfo = new Uint8Array([...encoder.encode('WebPush: info'), 0, ...p256dh, ...localPub]);
  
  const hkdfKey1 = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: auth, info: authInfo }, hkdfKey1, 256);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hkdfKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  
  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm'), 0]) }, hkdfKey2, 128);
  const iv = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: new Uint8Array([...encoder.encode('Content-Encoding: nonce'), 0]) }, hkdfKey2, 96);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plainText = encoder.encode(payload);
  const record = new Uint8Array(plainText.length + 1);
  record.set(plainText, 0);
  record.set([2], plainText.length);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv, tagLength: 128 }, aesKey, record);

  const result = new Uint8Array(21 + 65 + ciphertext.byteLength);
  result.set(salt, 0);
  result.set([0, 0, 16, 0], 16);
  result.set([65], 20);
  result.set(localPub, 21);
  result.set(new Uint8Array(ciphertext), 86);

  return result;
}

async function sendPush(sub: any, payload: string, pub: string, priv: string) {
  const url = new URL(sub.endpoint);
  
  const signingKey = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', ext: true,
    x: utils.fromBuf(utils.toBuf(pub).slice(1, 33)),
    y: utils.fromBuf(utils.toBuf(pub).slice(33, 65)),
    d: utils.fromBuf(utils.toBuf(priv))
  } as any, { name: 'ECDSA', namedCurve: 'P-256' } as any, false, ['sign']);

  const encoder = new TextEncoder();
  const header = utils.fromBuf(encoder.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
  const body = utils.fromBuf(encoder.encode(JSON.stringify({ 
    aud: url.origin, 
    exp: Math.floor(Date.now() / 1000) + 86400, 
    sub: 'mailto:admin@scparking.pages.dev' 
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' } as any, signingKey, encoder.encode(`${header}.${body}`) as any);
  const token = `${header}.${body}.${utils.fromBuf(new Uint8Array(sig))}`;

  console.log(`[PUSH] Sending to: ${sub.endpoint.substring(0, 40)}...`);

  const response = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${token}, k=${pub.replace(/=/g, '')}`,
      'TTL': '86400',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm'
    },
    body: await encryptPayload(sub, payload)
  });

  return response.status;
}

async function run() {
  const { data: subs } = await supabase.from('parking_push_subscriptions').select('subscription').order('created_at', { ascending: false }).limit(1);
  if (subs && subs.length > 0) {
    console.log("발송 시작!");
    const status = await sendPush(subs[0].subscription, JSON.stringify({ title: '정확한 로직 테스트', body: '이게 오면 암호화가 100% 맞는 겁니다!' }), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log("결과 코드:", status);
  }
}
run();
