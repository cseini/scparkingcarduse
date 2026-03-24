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
  cookieStore.set('selected_profile_id', id, { maxAge: 60 * 60 * 24 * 365, path: '/' })
  
  // 모든 페이지의 데이터를 서버측에서 다시 가져오도록 설정
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function addReport(profileId: number | null, type: string, content: string) {
  const { error } = await supabase
    .from('parking_app_feedback')
    .insert({ profile_id: profileId, type, content })

  if (error) {
    console.error('Error adding report:', error)
    return { success: false, error: '제출에 실패했습니다. 나중에 다시 시도해 주세요.' }
  }

  return { success: true }
}

// 자동 리셋 체크는 이제 필요 없으므로 빈 함수로 두거나 나중에 제거
export async function checkAutoReset(profileId: number) {
  return;
}