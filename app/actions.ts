'use server'

import { supabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'Asia/Seoul'

export async function getSeoulNow() {
  return toZonedTime(new Date(), TIMEZONE)
}

export async function getCardUsageCount(cardId: number, year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1)).toISOString()
  const end = endOfMonth(new Date(year, month - 1)).toISOString()
  const { count, error } = await supabase
    .from('parking_usage_history')
    .select('*', { count: 'exact', head: true })
    .eq('card_id', cardId)
    .gte('used_at', start)
    .lte('used_at', end)
  if (error) return 0
  return count || 0
}

export async function useParkingCard(id: number, date?: string) {
  const now = await getSeoulNow()
  const usageDate = date ? toZonedTime(new Date(date), TIMEZONE) : now
  const dateStr = format(usageDate, 'yyyy-MM-dd')
  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay = `${dateStr}T23:59:59.999Z`
  const { data: card, error: cardError } = await supabase
    .from('parking_cards')
    .select('user_name, profile_id')
    .eq('id', id)
    .single()
  if (cardError || !card) return { success: false, error: '카드 정보를 가져오는 데 실패했습니다.' }
  if (card.profile_id) {
    const { data: existingUsage } = await supabase
      .from('parking_usage_history')
      .select('id, parking_cards!inner(profile_id)')
      .gte('used_at', startOfDay)
      .lte('used_at', endOfDay)
      .eq('parking_cards.profile_id', card.profile_id)
      .limit(1)
    if (existingUsage && existingUsage.length > 0) return { success: false, error: '하루에 하나의 카드만 사용할 수 있습니다.' }
  }
  const currentCount = await getCardUsageCount(id, usageDate.getFullYear(), usageDate.getMonth() + 1)
  if (currentCount >= 3) return { success: false, error: '이번 달 사용 가능 횟수(3회)를 모두 사용했습니다.' }
  const { error: historyError } = await supabase
    .from('parking_usage_history')
    .insert({
      card_id: id,
      user_name: card.user_name,
      used_at: usageDate.toISOString()
    })
  if (historyError) return { success: false, error: `저장 실패: \${historyError.message}` }
  revalidatePath('/')
  return { success: true }
}

export async function getUsageHistory(year: number, month: number, profileId?: number) {
  const start = startOfMonth(new Date(year, month - 1)).toISOString()
  const end = endOfMonth(new Date(year, month - 1)).toISOString()
  let query = supabase
    .from('parking_usage_history')
    .select('*, parking_cards!inner(profile_id)')
    .gte('used_at', start)
    .lte('used_at', end)
    .order('used_at', { ascending: true })
  if (profileId) query = query.eq('parking_cards.profile_id', profileId)
  const { data } = await query
  return data || []
}

export async function addParkingCard(userName: string, profileId: number | null, color: string) {
  if (profileId) {
    const { data: existingColor } = await supabase.from('parking_cards').select('id').eq('profile_id', profileId).eq('color', color).limit(1)
    if (existingColor && existingColor.length > 0) return { success: false, error: '색상 중복' }
  }
  const { error } = await supabase.from('parking_cards').insert({ user_name: userName, profile_id: profileId, color })
  if (error) return { success: false, error: '카드 추가 실패' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteParkingCard(id: number) {
  const { error } = await supabase.from('parking_cards').delete().eq('id', id)
  if (error) return { success: false, error: '삭제 실패' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function updateParkingCard(id: number, userName: string, profileId: number | null, color: string) {
  if (profileId) {
    const { data: existingColor } = await supabase.from('parking_cards').select('id').eq('profile_id', profileId).eq('color', color).neq('id', id).limit(1)
    if (existingColor && existingColor.length > 0) return { success: false, error: '색상 중복' }
  }
  const { error } = await supabase.from('parking_cards').update({ user_name: userName, profile_id: profileId, color }).eq('id', id)
  if (error) return { success: false, error: '수정 실패' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteUsageHistory(historyId: number, cardId: number) {
  const { error: deleteError } = await supabase.from('parking_usage_history').delete().eq('id', historyId)
  if (deleteError) return { success: false, error: '삭제 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function getProfiles() {
  const { data } = await supabase.from('profiles').select('*').order('id')
  return data || []
}

export async function addProfile(name: string, pinCode: string) {
  const { error } = await supabase.from('profiles').insert({ name, pin_code: pinCode })
  if (error) return { success: false, error: '추가 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function updateProfile(id: number, name: string, pinCode?: string) {
  const updateData: any = { name }
  if (pinCode) updateData.pin_code = pinCode
  const { error } = await supabase.from('profiles').update(updateData).eq('id', id)
  if (error) return { success: false, error: '수정 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function checkProfilePin(id: number, pinCode: string) {
  const { data } = await supabase.from('profiles').select('pin_code').eq('id', id).single()
  if (data?.pin_code === pinCode) return { success: true }
  return { success: false, error: '핀코드 불일치' }
}

export async function deleteProfile(id: number) {
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) return { success: false, error: '삭제 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function setProfileCookieAction(id: string) {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set('selected_profile_id', id, { maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function getReports() {
  const { data } = await supabase.from('parking_app_feedback').select('*, profiles(name)').order('created_at', { ascending: false })
  return data || []
}

export async function deleteReport(id: number) {
  const { data, error } = await supabase.from('parking_app_feedback').delete().eq('id', id).select()
  if (error || !data || data.length === 0) return { success: false, error: '삭제 실패' }
  revalidatePath('/admin/reports')
  return { success: true }
}

// ---------------------------------------------------------
// 웹푸시 암호화 및 전송 로직 (Edge Runtime 호환)
// ---------------------------------------------------------

function base64UrlToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

function uint8ArrayToBase64Url(buf: Uint8Array) {
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function encryptPayload(subscription: any, payload: string) {
  const p256dh = base64UrlToUint8Array(subscription.keys.p256dh);
  const auth = base64UrlToUint8Array(subscription.keys.auth);
  
  // 1. 임시 키 생성
  const localKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublicKey = await crypto.subtle.exportKey('raw', localKeys.publicKey);
  
  // 2. 공유 비밀 생성
  const remoteKey = await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: remoteKey }, localKeys.privateKey, 256);
  
  // 3. 솔트 생성
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // 4. 정보(Info) 구성 (HKDF)
  const encoder = new TextEncoder();
  const info = new Uint8Array([
    ...encoder.encode('WebPush: info'), 0x00,
    ...p256dh,
    ...localPublicKey,
  ]);

  // 5. IKM 생성
  const prkAuth = await crypto.subtle.importKey('raw', auth, { name: 'HKDF' }, false, ['deriveBits']);
  const ikm = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode('Content-Encoding: auth\0') }, prkAuth, 256);

  // 6. PRK 생성
  const prkKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  
  // 7. CEK 및 IV 생성
  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: aes128gcm\0') }, prkKey, 128);
  const ivBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: encoder.encode('Content-Encoding: nonce\0') }, prkKey, 96);
  
  const cek = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = ivBits;

  // 8. 본문 암호화 (패딩 포함)
  const plainText = encoder.encode(payload);
  const dataToEncrypt = new Uint8Array(plainText.length + 2);
  dataToEncrypt.set(plainText, 0); // 본문
  dataToEncrypt.set([0x02, 0x00], plainText.length); // 종료 마커

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cek, dataToEncrypt);

  // 9. 최종 바이너리 페이로드 구성 (Header + Ciphertext)
  const combined = new Uint8Array(21 + localPublicKey.byteLength + ciphertext.byteLength);
  combined.set(salt, 0); // Salt (16)
  combined.set([0x00, 0x00, 0x10, 0x00], 16); // Record Size (4)
  combined.set([localPublicKey.byteLength], 20); // ID Length (1)
  combined.set(new Uint8Array(localPublicKey), 21); // Public Key
  combined.set(new Uint8Array(ciphertext), 21 + localPublicKey.byteLength); // Encrypted Data

  return combined;
}

async function sendEdgePush(subscription: any, payload: string, publicKey: string, privateKey: string) {
  const endpoint = subscription.endpoint;
  const origin = new URL(endpoint).origin;
  
  // JWT 생성
  const header = { alg: 'ES256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { aud: origin, exp: now + 86400, sub: 'mailto:admin@scparking.pages.dev' };
  const encoder = new TextEncoder();
  const tokenHeader = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(header)));
  const tokenBody = uint8ArrayToBase64Url(encoder.encode(JSON.stringify(body)));
  const unsignedToken = `\${tokenHeader}.\${tokenBody}`;

  const rawPrivate = base64UrlToUint8Array(privateKey);
  const key = await crypto.subtle.importKey('pkcs8', rawPrivate, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsignedToken));
  const signedToken = `\${unsignedToken}.\${uint8ArrayToBase64Url(new Uint8Array(signature))}`;

  // 페이로드 암호화
  const encryptedPayload = await encryptPayload(subscription, payload);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=\${signedToken}, k=\${publicKey}`,
      'TTL': '86400',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm'
    },
    body: encryptedPayload
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Push server error (\${response.status}): \${errorText}`);
  }
  return response;
}

export async function addReport(profileId: number | null, type: string, content: string) {
  const { error } = await supabase.from('parking_app_feedback').insert({ profile_id: profileId, type, content })
  if (error) return { success: false, error: '제출에 실패했습니다.' }

  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (publicKey && privateKey) {
      const { data: subs } = await supabase.from('parking_push_subscriptions').select('subscription');
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: type === 'bug' ? '🐞 새로운 버그 제보' : '💡 새로운 기능 제안',
          body: content.length > 50 ? content.substring(0, 50) + '...' : content,
          url: '/'
        });
        await Promise.allSettled((subs as any[]).map(async (sub: any) => {
          try {
            await sendEdgePush(sub.subscription, payload, publicKey, privateKey);
          } catch (e: any) {
            console.error('Edge 푸시 발송 오류:', e.message);
          }
        }));
      }
    }
  } catch (e: any) {
    console.error('전체 푸시 프로세스 오류:', e.message);
  }
  return { success: true };
}

export async function saveSubscription(profileId: number | null, subscription: any) {
  const { error } = await supabase.from('parking_push_subscriptions').insert({ profile_id: profileId, subscription })
  if (error) return { success: false, error: '알림 설정 저장 실패' }
  return { success: true }
}

export async function checkAutoReset(profileId: number) { return; }
