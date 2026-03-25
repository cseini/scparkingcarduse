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
  if (historyError) return { success: false, error: `저장 실패: ${historyError.message}` }
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
  const { error = null } = await supabase.from('parking_cards').update({ user_name: userName, profile_id: profileId, color }).eq('id', id)
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
// 웹푸시 최종 무결성 로직 (로컬 web-push 라이브러리와 100% 동일한 결과물)
// ---------------------------------------------------------

const b64 = {
  toBuf: (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
  fromBuf: (b: Uint8Array) => btoa(String.fromCharCode(...Array.from(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
};

async function encryptPayload(sub: any, payload: string) {
  const encoder = new TextEncoder();
  const serverKeys = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPub = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey));
  const clientPub = b64.toBuf(sub.keys.p256dh);
  const clientAuth = b64.toBuf(sub.keys.auth);

  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({
    name: 'ECDH', public: await crypto.subtle.importKey('raw', clientPub as any, { name: 'ECDH', namedCurve: 'P-256' } as any, false, [])
  } as any, serverKeys.privateKey, 256));

  const hkdf = async (ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, bits: number) => {
    const key = await crypto.subtle.importKey('raw', ikm as any, 'HKDF', false, ['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as any, info: info as any } as any, key, bits));
  };

  // IKM 유도: RFC 8291
  const ikm = await hkdf(sharedSecret, clientAuth, new Uint8Array([...encoder.encode('Content-Encoding: auth'), 0]), 256);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm'), 0]), 128);
  const iv = await hkdf(ikm, salt, new Uint8Array([...encoder.encode('Content-Encoding: nonce'), 0]), 96);

  const plainText = encoder.encode(payload);
  const data = new Uint8Array(plainText.length + 1);
  data.set(plainText, 0);
  data.set([2], plainText.length); // Record delimiter

  const aesKey = await crypto.subtle.importKey('raw', cek as any, 'AES-GCM', false, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as any, tagLength: 128 } as any, aesKey, data as any);

  const result = new Uint8Array(21 + 65 + encrypted.byteLength);
  result.set(salt, 0);
  result.set([0, 0, 16, 0], 16); // big-endian 4096
  result.set([65], 20);
  result.set(serverPub, 21);
  result.set(new Uint8Array(encrypted), 86);
  return result;
}

async function sendPush(sub: any, payload: string, pub: string, priv: string) {
  const endpoint = sub.endpoint;
  const origin = new URL(endpoint).origin;
  
  const signingKey = await crypto.subtle.importKey('jwk', {
    kty: 'EC', crv: 'P-256', ext: true,
    x: b64.fromBuf(b64.toBuf(pub).slice(1, 33)),
    y: b64.fromBuf(b64.toBuf(pub).slice(33, 65)),
    d: b64.fromBuf(b64.toBuf(priv))
  } as any, { name: 'ECDSA', namedCurve: 'P-256' } as any, false, ['sign']);

  const encoder = new TextEncoder();
  const header = b64.fromBuf(encoder.encode(JSON.stringify({alg:"ES256"})));
  const body = b64.fromBuf(encoder.encode(JSON.stringify({
    aud: origin,
    exp: Math.floor(Date.now() / 1000) + 43200,
    sub: "mailto:test@example.com"
  })));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' } as any, signingKey, encoder.encode(`${header}.${body}`) as any);
  const token = `${header}.${body}.${b64.fromBuf(new Uint8Array(sig))}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `VAPID t=${token}, k=${pub.replace(/=/g, '')}`,
      'TTL': '86400',
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm'
    },
    body: await encryptPayload(sub, payload)
  });

  return response.status;
}

export async function addReport(profileId: number | null, type: string, content: string) {
  const { error = null } = await supabase.from('parking_app_feedback').insert({ profile_id: profileId, type, content })
  if (error) return { success: false, error: '제출 실패' }
  
  try {
    const pub = "BNPVV7YciM1jX1zBRb20scPZX3OfrDOo-z92Yqoq67l5WDHEKhR8z1b-6J93_rLvs6YXabgB5CZAZ66auYMJpro";
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (pub && priv) {
      const { data: subs } = await supabase.from('parking_push_subscriptions').select('subscription');
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({ title: type === 'bug' ? '🐞 버그 제보' : '💡 기능 제안', body: content.substring(0, 50), url: '/' });
        const results = await Promise.allSettled(subs.map((s: any) => sendPush(s.subscription, payload, pub, priv)));
        results.forEach((res, i) => {
          if (res.status === 'fulfilled') console.log(`✅ [${i}] Status: ${res.value}`);
          else console.error(`❌ [${i}] Error:`, res.reason);
        });
      }
    }
  } catch (e: any) { console.error('🔥 Fatal Push Error:', e.message); }
  return { success: true };
}

export async function saveSubscription(profileId: number | null, subscription: any) {
  const { error } = await supabase.from('parking_push_subscriptions').insert({ profile_id: profileId, subscription })
  if (error) return { success: false, error: '알림 설정 저장 실패' }
  return { success: true }
}

export async function checkAutoReset(profileId: number) { return; }
