
// @ts-nocheck
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.local 로드
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
  const privateKey = process.env.VAPID_PRIVATE_KEY!;

  if (!publicKey || !privateKey || publicKey.includes('your_')) {
    console.error("❌ VAPID 키가 설정되지 않았거나 플레이스홀더 상태입니다.");
    return;
  }

  webpush.setVapidDetails(
    'mailto:test@example.com',
    publicKey,
    privateKey
  );

  console.log("🔍 DB에서 구독 정보 조회 중...");
  const { data: subs, error } = await supabase
    .from('parking_push_subscriptions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error || !subs || subs.length === 0) {
    console.error("❌ 구독 정보를 찾을 수 없습니다. 브라우저에서 먼저 '알림 허용'을 해주세요.");
    return;
  }

  const subscription = subs[0].subscription;
  const payload = JSON.stringify({
    title: '🚀 테스트 알림',
    body: 'Gemini CLI에서 보낸 테스트 푸시 메시지입니다!',
    url: '/'
  });

  console.log("📤 푸시 알림 발송 시도 중...");
  try {
    await webpush.sendNotification(subscription, payload);
    console.log("✅ 푸시 알림 발송 성공!");
  } catch (err: any) {
    console.error("❌ 푸시 알림 발송 실패:");
    if (err.statusCode) {
      console.error(`- 상태 코드: ${err.statusCode}`);
      console.error(`- 응답 본문: ${err.body}`);
    }
    console.error(`- 메시지: ${err.message}`);
    
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.error("⚠️ 해당 구독 정보가 만료되었거나 유효하지 않습니다. 브라우저에서 알림을 다시 허용해 주세요.");
    } else if (err.statusCode === 403) {
      console.error("⚠️ VAPID 키 인증 실패 (Forbidden). Public/Private 키 쌍이 일치하는지, 클라이언트와 서버의 키가 동일한지 확인하세요.");
    }
  }
}

testPush();
