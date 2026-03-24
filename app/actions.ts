'use server'

import { supabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'
import { startOfMonth, endOfMonth } from 'date-fns'

export async function useParkingCard(id: number, date?: string) {
  const usageDate = date ? new Date(date) : new Date()
  
  // 1. Get current card status
  const { data: card, error: cardError } = await supabase
    .from('parking_cards')
    .select('remaining_uses, user_name')
    .eq('id', id)
    .single()

  if (cardError || !card) {
    console.error('Error fetching card:', cardError)
    return { success: false, error: '카드 정보를 가져오는 데 실패했습니다.' }
  }

  if (card.remaining_uses <= 0) {
    return { success: false, error: '남은 횟수가 없습니다.' }
  }

  // 2. Insert usage history record
  const { error: historyError } = await supabase
    .from('parking_usage_history')
    .insert({
      card_id: id,
      user_name: card.user_name,
      used_at: usageDate.toISOString()
    })

  if (historyError) {
    console.error('Error inserting history:', historyError)
    return { success: false, error: '사용 기록 저장에 실패했습니다.' }
  }

  // 3. Update remaining uses
  const { error: updateError } = await supabase
    .from('parking_cards')
    .update({ 
      remaining_uses: card.remaining_uses - 1,
      last_used_at: usageDate.toISOString()
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error updating card:', updateError)
    return { success: false, error: '업데이트 중 오류가 발생했습니다.' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function resetAllCards() {
  const { error: updateError } = await supabase
    .from('parking_cards')
    .update({ remaining_uses: 3 })
    .neq('id', 0)

  if (updateError) {
    console.error('Error resetting cards:', updateError)
    return { success: false, error: '카드 초기화 중 오류가 발생했습니다.' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function initializeCards() {
  const users = ['나', '와이프', '형', '처남']
  
  const { data: existingData } = await supabase.from('parking_cards').select('id')
  
  if (existingData && existingData.length > 0) {
    return { success: true, message: '이미 초기화되어 있습니다.' }
  }

  const { error } = await supabase
    .from('parking_cards')
    .insert(users.map(user => ({ user_name: user, remaining_uses: 3 })))

  if (error) {
    console.error('Error initializing cards:', error)
    return { success: false, error: '초기화 데이터 삽입 중 오류가 발생했습니다.' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function getUsageHistory(year: number, month: number, profileId?: number) {
  const start = startOfMonth(new Date(year, month - 1)).toISOString()
  const end = endOfMonth(new Date(year, month - 1)).toISOString()

  let query = supabase
    .from('parking_usage_history')
    .select('*, parking_cards(profile_id)')
    .gte('used_at', start)
    .lte('used_at', end)
    .order('used_at', { ascending: true })

  const { data, error } = await query

  if (error) {
    console.error('Error fetching history:', error)
    return []
  }

  let filteredData = data || []
  if (profileId) {
    filteredData = filteredData.filter(h => h.parking_cards?.profile_id === profileId)
  }

  return filteredData
}

export async function addParkingCard(userName: string, profileId: number | null, color: string) {
  const { error } = await supabase
    .from('parking_cards')
    .insert({ user_name: userName, remaining_uses: 3, profile_id: profileId, color })

  if (error) {
    console.error('Error adding card:', error)
    return { success: false, error: '카드 추가 중 오류가 발생했습니다.' }
  }

  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteParkingCard(id: number) {
  const { error } = await supabase
    .from('parking_cards')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting card:', error)
    return { success: false, error: '사용 기록이 있는 카드는 삭제할 수 없거나 삭제 중 오류가 발생했습니다.' }
  }

  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function updateParkingCard(id: number, userName: string, remainingUses: number, profileId: number | null, color: string) {
  const { error } = await supabase
    .from('parking_cards')
    .update({ user_name: userName, remaining_uses: remainingUses, profile_id: profileId, color })
    .eq('id', id)

  if (error) {
    console.error('Error updating card:', error)
    return { success: false, error: '카드 정보 수정 중 오류가 발생했습니다.' }
  }

  revalidatePath('/')
  revalidatePath('/manage')
  return { success: true }
}

export async function deleteUsageHistory(historyId: number, cardId: number) {
  // 1. Get current card status to refund the usage
  const { data: card, error: cardError } = await supabase
    .from('parking_cards')
    .select('remaining_uses')
    .eq('id', cardId)
    .single()

  if (cardError || !card) {
    console.error('Error fetching card for refund:', cardError)
    return { success: false, error: '카드 정보를 가져오는 데 실패했습니다.' }
  }

  // 2. Delete the history record
  const { error: deleteError } = await supabase
    .from('parking_usage_history')
    .delete()
    .eq('id', historyId)

  if (deleteError) {
    console.error('Error deleting history:', deleteError)
    return { success: false, error: '이력 삭제 중 오류가 발생했습니다.' }
  }

  // 3. Refund the usage count
  const { error: updateError } = await supabase
    .from('parking_cards')
    .update({ remaining_uses: card.remaining_uses + 1 })
    .eq('id', cardId)

  if (updateError) {
    console.error('Error refunding card usage:', updateError)
    // Even if refund fails, the history is deleted. But let's report the error.
    return { success: false, error: '이력은 삭제되었으나 카드 횟수 복구에 실패했습니다.' }
  }

  revalidatePath('/')
  return { success: true }
}

export async function getProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('id')
  if (error) {
    console.error('Error fetching profiles:', error)
    return []
  }
  return data || []
}

export async function addProfile(name: string) {
  const { error } = await supabase.from('profiles').insert({ name })
  if (error) {
    console.error('Error adding profile:', error)
    return { success: false, error: '프로필 추가 중 오류가 발생했습니다.' }
  }
  revalidatePath('/')
  revalidatePath('/manage')
  revalidatePath('/profiles')
  return { success: true }
}

export async function updateProfile(id: number, name: string) {
  const { error } = await supabase.from('profiles').update({ name }).eq('id', id)
  if (error) {
    console.error('Error updating profile:', error)
    return { success: false, error: '프로필 수정 중 오류가 발생했습니다.' }
  }
  revalidatePath('/')
  revalidatePath('/manage')
  revalidatePath('/profiles')
  return { success: true }
}

export async function deleteProfile(id: number) {
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  if (error) {
    console.error('Error deleting profile:', error)
    return { success: false, error: '프로필 삭제 중 오류가 발생했습니다.' }
  }
  revalidatePath('/')
  revalidatePath('/manage')
  revalidatePath('/profiles')
  return { success: true }
}