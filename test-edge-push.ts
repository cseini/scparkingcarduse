
// @ts-nocheck
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function uint8ArrayToBase64Url(buf: any) {
  const uint8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...Array.from(uint8))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function encryptPayload(subscription: any, payload: string) {
  const p256dh = base64UrlToUint8Array(subscription.keys.p256dh);
  const auth = base64UrlToUint8Array(subscription.keys.auth);
  const encoder = new TextEncoder();

  // 1. 임시 키 쌍 생성
  const localKeys = await globalThis.crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicKey = new Uint8Array(await globalThis.crypto.subtle.exportKey('raw', localKeys.publicKey));
  
  // 2. 공유 비밀(Shared Secret) 생성
  const remoteKey = await globalThis.crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = new Uint8Array(await globalThis.crypto.subtle.deriveBits({ name: 'ECDH', public: remoteKey }, localKeys.privateKey, 256));
  
  // 3. RFC 8291 키 유도 체인 (정밀 보정)
  const hkdfExtract = async (salt: Uint8Array, ikm: Uint8Array) => {
    const key = await crypto.subtle.importKey('raw', salt, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: ikm }, key, 256));
  };
  const hkdfExpand = async (prk: Uint8Array, info: Uint8Array, len: number) => {
    const key = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info }, key, len));
  };

  // IKM 유도: HKDF-Extract(auth, shared_secret) -> HKDF-Expand(IKM, "Content-Encoding: auth\0", 32)
  const prkAuth = await hkdfExtract(auth, sharedSecret);
  const ikm = await hkdfExpand(prkAuth, encoder.encode('Content-Encoding: auth\0'), 256);

  // Salt 생성 및 PRK 유도
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hkdfExtract(salt, ikm);
  
  // CEK(16바이트) 및 IV(12바이트) 유도
  const cek = await hkdfExpand(prk, encoder.encode('Content-Encoding: aes128gcm\0'), 128);
  const iv = await hkdfExpand(prk, encoder.encode('Content-Encoding: nonce\0'), 96);

  // 4. AES-128-GCM 암호화
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plainText = encoder.encode(payload);
  const dataToEncrypt = new Uint8Array(plainText.length + 1);
  dataToEncrypt.set(plainText, 0);
  dataToEncrypt.set([0x02], plainText.length); // 0x02 is the delimiter for aes128gcm

  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, dataToEncrypt));

  // 5. 최종 바이너리 구성 (RFC 8291 Header)
  // salt(16) | rs(4) | idlen(1) | key(65) | ciphertext
  const result = new Uint8Array(21 + localPublicKey.length + ciphertext.length);
  result.set(salt, 0);
  result.set([0x00, 0x00, 0x10, 0x00], 16); // rs=4096
  result.set([localPublicKey.length], 20);
  result.set(localPublicKey, 21);
  result.set(ciphertext, 21 + localPublicKey.length);

  return result;
}

async function runTest() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;

  const { data: subs } = await supabase.from('parking_push_subscriptions').select('*').order('created_at', { ascending: false }).limit(1);
  if (!subs || subs.length === 0) return console.error('❌ 구독 정보 없음');

  const sub = subs[0].subscription;
  const payload = JSON.stringify({
    title: '🚨 암호화 심층 보정 테스트',
    body: '이 메시지는 RFC 8291 풀 체인을 적용한 것입니다.',
    url: '/'
  });

  console.log('📤 표준 규격(RFC 8291) 풀 체인 발송 시도...');
  try {
    const endpoint = sub.endpoint;
    const origin = new URL(endpoint).origin;
    
    // JWT 서명 (이미 검증됨)
    const rawPublic = base64UrlToUint8Array(publicKey);
    const rawPrivate = base64UrlToUint8Array(privateKey);
    const jwk = {
      kty: 'EC', crv: 'P-256',
      x: uint8ArrayToBase64Url(rawPublic.slice(1, 33)),
      y: uint8ArrayToBase64Url(rawPublic.slice(33, 65)),
      d: uint8ArrayToBase64Url(rawPrivate),
      ext: true
    };
    const signingKey = await globalThis.crypto.subtle.importKey('jwk', jwk as any, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const encoder = new TextEncoder();
    const jwtHeader = uint8ArrayToBase64Url(encoder.encode(JSON.stringify({ alg: 'ES256', typ: 'JWT' })));
    const jwtBody = uint8ArrayToBase64Url(encoder.encode(JSON.stringify({ aud: origin, exp: Math.floor(Date.now() / 1000) + 86400, sub: 'mailto:admin@scparking.pages.dev' })));
    const unsignedToken = `${jwtHeader}.${jwtBody}`;
    const sig = await globalThis.crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, encoder.encode(unsignedToken));
    const signedToken = `${unsignedToken}.${uint8ArrayToBase64Url(new Uint8Array(sig))}`;

    // 정밀 암호화된 페이로드 생성
    const encryptedPayload = await encryptPayload(sub, payload);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `vapid t=${signedToken}, k=${publicKey}`,
        'TTL': '86400',
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm'
      },
      body: encryptedPayload
    });

    console.log(`✅ 서버 응답: ${response.status}`);
    if (response.ok) {
      console.log('🚀 애플 서버가 메시지를 접수했습니다. 이제 기기를 확인해 보세요!');
    } else {
      console.error('❌ 전송 실패:', await response.text());
    }
  } catch (err: any) {
    console.error('❌ 에러 발생:', err.message);
  }
}

runTest();
