'use server'

import { supabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'

const TIMEZONE = 'Asia/Seoul'

export async function getSeoulNow() {
  return toZonedTime(new Date(), TIMEZONE)
}

export async function checkAutoReset(profileId: number) {
  const now = await getSeoulNow()
  const currentMonth = format(now, 'yyyy-MM')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('last_reset_month')
    .eq('id', profileId)
    .single()

  if (profileError || !profile) return

  if (profile.last_reset_month !== currentMonth) {
    const { error: resetError } = await supabase
      .from('parking_cards')
      .update({ remaining_uses: 3 })
      .eq('profile_id', profileId)

    if (!resetError) {
      await supabase
        .from('profiles')
        .update({ last_reset_month: currentMonth })
        .eq('id', profileId)
      revalidatePath('/')
      revalidatePath('/manage')
    }
  }
}

export async function useParkingCard(id: number, date?: string) {
  const now = await getSeoulNow()
  const usageDate = date ? toZonedTime(new Date(date), TIMEZONE) : now
  const dateStr = format(usageDate, 'yyyy-MM-dd')
  const startOfDay = `${dateStr}T00:00:00.000Z`
  const endOfDay = `${dateStr}T23:59:59.999Z`
  
  console.log(`[Action] useParkingCard: ID ${id}, Date ${dateStr}`)

  const { data: card, error: cardError } = await supabase
    .from('parking_cards')
    .select('remaining_uses, user_name, profile_id')
    .eq('id', id)
    .single()

  if (cardError || !card) {
    console.error('Error fetching card:', cardError)
    return { success: false, error: '카드 정보를 가져오는 데 실패했습니다.' }
  }

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
    await checkAutoReset(card.profile_id)
  }

  if (card.remaining_uses <= 0) {
    return { success: false, error: '남은 횟수가 없습니다.' }
  }

  const { error: historyError } = await supabase
    .from('parking_usage_history')
    .insert({
      card_id: id,
      user_name: card.user_name,
      used_at: usageDate.toISOString()
    })

  if (historyError) {
    console.error('Error inserting history:', historyError)
    return { success: false, error: `저장 실패: ${historyError.message}` }
  }

  const { error: updateError } = await supabase
    .from('parking_cards')
    .update({ 
      remaining_uses: card.remaining_uses - 1,
      last_used_at: usageDate.toISOString()
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error updating card:', updateError)
    return { success: false, error: `업데이트 실패: ${updateError.message}` }
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
  if (error) {
    console.error('Error fetching history:', error)
    return []
  }
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
    if (existingColor && existingColor.length > 0) {
      return { success: false, error: '이미 사용 중인 색상입니다.' }
    }
  }

  const { error } = await supabase
    .from('parking_cards')
    .insert({ user_name: userName, remaining_uses: 3, profile_id: profileId, color })

  if (error) return { success: false, error: '카드 추가 실패' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteParkingCard(id: number) {
  const { error } = await supabase.from('parking_cards').delete().eq('id', id)
  if (error) return { success: false, error: '삭제 실패 (사용 이력이 있을 수 있음)' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function updateParkingCard(id: number, userName: string, remainingUses: number, profileId: number | null, color: string) {
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
    .update({ user_name: userName, remaining_uses: remainingUses, profile_id: profileId, color })
    .eq('id', id)

  if (error) return { success: false, error: '수정 실패' }
  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteUsageHistory(historyId: number, cardId: number) {
  console.log(`[Action] 삭제 시도 - 이력 ID: ${historyId}, 카드 ID: ${cardId}`);
  
  // 1. 해당 카드의 현재 남은 횟수 조회
  const { data: card, error: fetchError } = await supabase
    .from('parking_cards')
    .select('remaining_uses')
    .eq('id', cardId)
    .single();

  if (fetchError || !card) {
    console.error('[Action] 카드 조회 실패:', fetchError);
    return { success: false, error: '복구할 카드 정보를 찾을 수 없습니다.' };
  }

  // 2. 사용 이력 삭제
  const { error: deleteError } = await supabase
    .from('parking_usage_history')
    .delete()
    .eq('id', historyId);

  if (deleteError) {
    console.error('[Action] 이력 삭제 실패:', deleteError);
    return { success: false, error: `이력 삭제에 실패했습니다: ${deleteError.message}` };
  }

  // 3. 카드 횟수 복구 (+1)
  const { error: updateError } = await supabase
    .from('parking_cards')
    .update({ remaining_uses: card.remaining_uses + 1 })
    .eq('id', cardId);

  if (updateError) {
    console.error('[Action] 횟수 복구 실패:', updateError);
    return { success: false, error: '이력은 삭제되었으나 횟수 복구에 실패했습니다.' };
  }

  console.log('[Action] 삭제 및 복구 완료');
  revalidatePath('/');
  revalidatePath('/manage');
  return { success: true };
}

export async function getProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('id')
  if (error) return []
  return data || []
}

export async function addProfile(name: string, pinCode: string) {
  const { error } = await supabase.from('profiles').insert({ name, pin_code: pinCode })
  if (error) return { success: false, error: '프로필 추가 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function updateProfile(id: number, name: string, pinCode?: string) {
  const updateData: any = { name }
  if (pinCode) updateData.pin_code = pinCode
  const { error } = await supabase.from('profiles').update(updateData).eq('id', id)
  if (error) return { success: false, error: '프로필 수정 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function checkProfilePin(id: number, pinCode: string) {
  const { data, error } = await supabase.from('profiles').select('pin_code').eq('id', id).single()
  if (error || !data) return { success: false, error: '프로필 없음' }
  if (data.pin_code === pinCode) return { success: true }
  return { success: false, error: '핀코드 불일치' }
}

export async function deleteProfile(id: number) {
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) return { success: false, error: '프로필 삭제 실패' }
  revalidatePath('/')
  return { success: true }
}

export async function setProfileCookieAction(id: string) {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  cookieStore.set('selected_profile_id', id, { maxAge: 60 * 60 * 24 * 365, path: '/' })
  revalidatePath('/')
  return { success: true }
}
