'use server'

import { supabase } from '@/lib/supabaseClient'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
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
  const { error = null } = await supabase.from('parking_cards').delete().eq('id', id)
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
  const { data } = await supabaseAdmin
    .from('parking_app_feedback')
    .select('*, profiles(name), parking_report_comments(id, author_name, content, is_admin, created_at, profile_id)')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getMyReports(profileId: number) {
  const { data } = await supabaseAdmin
    .from('parking_app_feedback')
    .select('*, parking_report_comments(id, author_name, content, is_admin, created_at, profile_id)')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function deleteReport(id: number) {
  const { data, error } = await supabase.from('parking_app_feedback').delete().eq('id', id).select()
  if (error || !data || data.length === 0) return { success: false, error: '삭제 실패' }
  revalidatePath('/admin/reports')
  return { success: true }
}

// ---------------------------------------------------------
// 댓글 관련 액션
// ---------------------------------------------------------

export async function addComment(
  reportId: number,
  profileId: number | null,
  authorName: string,
  content: string,
  isAdmin: boolean
) {
  const { error } = await supabaseAdmin
    .from('parking_report_comments')
    .insert({ report_id: reportId, profile_id: profileId, author_name: authorName, content, is_admin: isAdmin })
  if (error) return { success: false, error: '댓글 저장 실패' }

  // 푸시 알림 발송
  if (isAdmin) {
    await sendPushToReportAuthor(reportId, {
      title: '💬 세인님의 답글',
      body: content.length > 60 ? content.substring(0, 60) + '...' : content,
      url: `/report?id=${reportId}`
    })
  } else {
    await sendPushToSein({
      title: `💬 ${authorName}님의 댓글`,
      body: content.length > 60 ? content.substring(0, 60) + '...' : content,
      url: `/admin/reports?id=${reportId}`
    })
  }

  revalidatePath('/admin/reports')
  revalidatePath('/report')
  return { success: true }
}

export async function deleteComment(id: number) {
  const { error } = await supabaseAdmin.from('parking_report_comments').delete().eq('id', id)
  if (error) return { success: false, error: '삭제 실패' }
  revalidatePath('/admin/reports')
  revalidatePath('/report')
  return { success: true }
}

// ---------------------------------------------------------
// 웹푸시 최종 정석 로직 (RFC 8291 완벽 대응)
// ---------------------------------------------------------

const VAPID_PUBLIC_KEY = "BNPVV7YciM1jX1zBRb20scPZX3OfrDOo-z92Yqoq67l5WDHEKhR8z1b-6J93_rLvs6YXabgB5CZAZ66auYMJpro";

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

  const sharedSecret = await crypto.subtle.deriveBits({ name: 'ECDH', public: remotePub } as any, localKeys.privateKey, 256);

  const authInfo = new Uint8Array([...encoder.encode('WebPush: info'), 0, ...p256dh, ...localPub]);

  const hkdfKey1 = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
  const ikm = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: auth, info: authInfo } as any, hkdfKey1, 256);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hkdfKey2 = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);

  const cek = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: new Uint8Array([...encoder.encode('Content-Encoding: aes128gcm'), 0]) } as any, hkdfKey2, 128);
  const iv = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt, info: new Uint8Array([...encoder.encode('Content-Encoding: nonce'), 0]) } as any, hkdfKey2, 96);

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plainText = encoder.encode(payload);
  const record = new Uint8Array(plainText.length + 1);
  record.set(plainText, 0);
  record.set([2], plainText.length);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 } as any, aesKey, record);

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

async function sendPushToSein(payload: { title: string; body: string; url: string }) {
  try {
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!priv) return { success: false, error: '비공개 키 없음' };

    const { data: subs, error } = await supabaseAdmin
      .from('parking_push_subscriptions')
      .select('subscription, profiles!inner(name)')
      .eq('profiles.name', '세인');

    if (error) return { success: false, error: error.message };

    if (subs && subs.length > 0) {
      const payloadStr = JSON.stringify(payload);
      let successCount = 0;
      for (const s of subs) {
        const status = await sendPush(s.subscription, payloadStr, VAPID_PUBLIC_KEY, priv);
        if (status === 201) successCount++;
      }
      return { success: successCount > 0, count: successCount };
    }
    return { success: false, error: '구독 정보 없음' };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

async function sendPushToReportAuthor(reportId: number, payload: { title: string; body: string; url: string }) {
  try {
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!priv) return;

    const { data: report } = await supabaseAdmin
      .from('parking_app_feedback')
      .select('profile_id')
      .eq('id', reportId)
      .single();
    if (!report?.profile_id) return;

    const { data: subs } = await supabaseAdmin
      .from('parking_push_subscriptions')
      .select('subscription')
      .eq('profile_id', report.profile_id);
    if (!subs || subs.length === 0) return;

    const payloadStr = JSON.stringify(payload);
    for (const s of subs) {
      await sendPush(s.subscription, payloadStr, VAPID_PUBLIC_KEY, priv);
    }
  } catch {
    // 푸시 실패는 조용히 처리
  }
}

export async function addReport(profileId: number | null, type: string, content: string) {
  const { error = null } = await supabase.from('parking_app_feedback').insert({ profile_id: profileId, type, content })
  if (error) return { success: false, error: '제출 실패' }

  await sendPushToSein({
    title: type === 'bug' ? '🐞 새로운 버그 제보' : '💡 기능 제안',
    body: content.length > 50 ? content.substring(0, 50) + '...' : content,
    url: '/admin/reports'
  });

  return { success: true };
}

export async function saveSubscription(profileId: number | null, subscription: any) {
  const { error } = await supabase.from('parking_push_subscriptions').insert({ profile_id: profileId, subscription })
  if (error) return { success: false, error: '알림 설정 저장 실패' }
  return { success: true }
}

export async function checkAutoReset(profileId: number) { return; }
