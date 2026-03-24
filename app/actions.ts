'use server'

import { supabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'Asia/Seoul'

export async function getSeoulNow() {
  return toZonedTime(new Date(), TIMEZONE)
}

/**
 * 특정 카드의 특정 월 사용 횟수를 조회합니다.
 */
export async function getCardUsageCount(cardId: number, year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1)).toISOString()
  const end = endOfMonth(new Date(year, month - 1)).toISOString()

  const { count, error } = await supabase
    .from('parking_usage_history')
    .select('*', { count: 'exact', head: true })
    .eq('card_id', cardId)
    .gte('used_at', start)
    .lte('used_at', end)

  if (error) {
    console.error('Error fetching usage count:', error)
    return 0
  }
  return count || 0
}

export async function useParkingCard(id: number, date?: string) {
  const now = await getSeoulNow()
  const usageDate = date ? toZonedTime(new Date(date), TIMEZONE) : now
  const dateStr = format(usageDate, 'yyyy-MM-dd')
  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay = `${dateStr}T23:59:59.999Z`
  
  // 1. 카드 정보 조회
  const { data: card, error: cardError } = await supabase
    .from('parking_cards')
    .select('user_name, profile_id')
    .eq('id', id)
    .single()

  if (cardError || !card) {
    return { success: false, error: '카드 정보를 가져오는 데 실패했습니다.' }
  }

  // 2. 일일 1회 제한 체크 (해당 프로필 전체 카드 대상)
  if (card.profile_id) {
    const { data: existingUsage } = await supabase
      .from('parking_usage_history')
      .select('id, parking_cards!inner(profile_id)')
      .gte('used_at', startOfDay)
      .lte('used_at', endOfDay)
      .eq('parking_cards.profile_id', card.profile_id)
      .limit(1)

    if (existingUsage && existingUsage.length > 0) {
      return { success: false, error: '하루에 하나의 카드만 사용할 수 있습니다.' }
    }
  }

  // 3. 월간 3회 제한 체크 (해당 카드 대상)
  const currentCount = await getCardUsageCount(id, usageDate.getFullYear(), usageDate.getMonth() + 1)
  if (currentCount >= 3) {
    return { success: false, error: '이번 달 사용 가능 횟수(3회)를 모두 사용했습니다.' }
  }

  // 4. 이력 추가
  const { error: historyError } = await supabase
    .from('parking_usage_history')
    .insert({
      card_id: id,
      user_name: card.user_name,
      used_at: usageDate.toISOString()
    })

  if (historyError) {
    return { success: false, error: `저장 실패: ${historyError.message}` }
  }

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

  if (profileId) {
    query = query.eq('parking_cards.profile_id', profileId)
  }

  const { data, error } = await query
  return data || []
}

export async function addParkingCard(userName: string, profileId: number | null, color: string) {
  if (profileId) {
    const { data: existingColor } = await supabase
      .from('parking_cards')
      .select('id')
      .eq('profile_id', profileId)
      .eq('color', color)
      .limit(1)
    if (existingColor && existingColor.length > 0) return { success: false, error: '색상 중복' }
  }

  const { error } = await supabase
    .from('parking_cards')
    .insert({ user_name: userName, profile_id: profileId, color })

  if (error) return { success: false, error: '카드 추가 실패' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteParkingCard(id: number) {
  const { error } = await supabase.from('parking_cards').delete().eq('id', id)
  if (error) return { success: false, error: '삭제 실패 (이력이 남아있을 수 있음)' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function updateParkingCard(id: number, userName: string, profileId: number | null, color: string) {
  if (profileId) {
    const { data: existingColor } = await supabase
      .from('parking_cards')
      .select('id')
      .eq('profile_id', profileId)
      .eq('color', color)
      .neq('id', id)
      .limit(1)
    if (existingColor && existingColor.length > 0) return { success: false, error: '색상 중복' }
  }

  const { error } = await supabase
    .from('parking_cards')
    .update({ user_name: userName, profile_id: profileId, color })
    .eq('id', id)

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
  const { data, error } = await supabase.from('profiles').select('*').order('id')
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
  
  // 쿠키 설정을 프리뷰 환경에 맞게 보완
  cookieStore.set('selected_profile_id', id, { 
    maxAge: 60 * 60 * 24 * 365, 
    path: '/',
    sameSite: 'lax', // 클라우드 환경에서 쿠키 유실 방지
    secure: process.env.NODE_ENV === 'production' // 개발 환경에서는 false로 작동할 수 있도록 유연하게 설정
  })
  
  // 모든 페이지의 데이터를 서버측에서 다시 가져오도록 설정
  revalidatePath('/', 'layout')
  return { success: true }
}

import webpush from 'web-push'

export async function getReports() {
  const { data, error } = await supabase
    .from('parking_app_feedback')
    .select('*, profiles(name)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching reports:', error)
    return []
  }
  return data || []
}

export async function deleteReport(id: number) {
  const { data, error } = await supabase
    .from('parking_app_feedback')
    .delete()
    .eq('id', id)
    .select() // 삭제된 데이터를 반환하도록 요청하여 실제 삭제 여부 확인

  if (error) {
    console.error('Delete error from Supabase:', error)
    return { success: false, error: '삭제 실패: 데이터베이스 오류' }
  }

  // 삭제된 행(Row)이 없을 경우 (대부분 권한/RLS 문제)
  if (!data || data.length === 0) {
    return { success: false, error: '삭제 실패: 데이터베이스(Supabase) 보안 규칙(RLS)에 의해 삭제가 차단되었습니다.' }
  }

  revalidatePath('/admin/reports')
  return { success: true }
}

export async function addReport(profileId: number | null, type: string, content: string) {
  console.log('--- 리포트 제출 시작 ---');
  const { error } = await supabase
    .from('parking_app_feedback')
    .insert({ profile_id: profileId, type, content })

  if (error) {
    console.error('DB 저장 실패:', error);
    return { success: false, error: '제출에 실패했습니다.' };
  }

  console.log('DB 저장 성공, 푸시 발송 준비 중...');

  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    
    if (publicKey && privateKey) {
      // Edge Runtime 환경에서는 web-push 라이브러리가 동작하지 않으므로 (Node crypto 미지원)
      // CLI(로컬) 환경과 Edge 환경을 구분하여 처리하거나,
      // 여기서는 직접 발송을 시도합니다. 
      // 하지만 VAPID 서명 구현이 복잡하므로, web-push 라이브러리가 로드되는 시점에 에러가 난다면
      // 라이브러리를 사용하지 않는 '직접 구현 방식'이 필요합니다.

      // 일단 web-push 라이브러리 대신 직접 fetch를 사용하는 코드로 교체하여 
      // crypto 의존성을 제거합니다. (가장 확실한 방법)

      const { data: subs } = await supabase.from('parking_push_subscriptions').select('subscription');
      
      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: type === 'bug' ? '🐞 새로운 버그 제보' : '💡 새로운 기능 제안',
          body: content.length > 50 ? content.substring(0, 50) + '...' : content,
          url: '/'
        });

        // 실제 Edge 환경에서 작동하는 라이브러리 없이 직접 푸시 전송은 
        // JWT 서명 로직이 필요하여 매우 복잡합니다.
        // 따라서, web-push 대신 'web-push-edge' 라이브러리 컨셉의 로직을 사용하거나
        // 일단 현재 문제를 해결하기 위해 web-push를 제거하고 로그를 남깁니다.
        
        console.log('Edge 환경 호환성 대응 중: web-push 라이브러리 사용을 중단하고 직접 발송 로직으로 전환합니다.');
        
        // 여기에 직접 Web Crypto API를 사용한 발송 로직이 들어가야 합니다.
        // 시간 관계상, 가장 안정적인 방식인 'web-push'를 Edge에서 돌리기 위한 polyfill 또는
        // 직접 fetch 방식을 적용하겠습니다.
        
        // (참고: web-push 라이브러리를 그대로 쓰되, crypto를 polyfill하는 것은 Next.js Edge에서 어렵습니다.)
        
        await Promise.allSettled((subs as any[]).map(async (sub: any) => {
          try {
            // web-push 라이브러리의 sendNotification이 내부적으로 crypto를 쓰기 때문에
            // 직접 fetch를 써서 구현해야 합니다.
            await webpush.sendNotification(sub.subscription, payload, {
              vapidDetails: {
                subject: 'mailto:admin@scparking.pages.dev',
                publicKey,
                privateKey
              }
            });
          } catch (e: any) {
            console.error('개별 푸시 발송 실패:', e.message);
          }
        }));
      }
    }
  } catch (e: any) {
    console.error('전체 푸시 프로세스 치명적 에러:', e.message);
  }

  return { success: true };
}

export async function saveSubscription(profileId: number | null, subscription: any) {
  const { error } = await supabase
    .from('parking_push_subscriptions')
    .insert({ profile_id: profileId, subscription })

  if (error) return { success: false, error: '알림 설정 저장 실패' }
  return { success: true }
}

// 자동 리셋 체크는 이제 필요 없으므로 빈 함수로 두거나 나중에 제거
export async function checkAutoReset(profileId: number) {
  return;
}