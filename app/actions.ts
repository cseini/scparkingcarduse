'use server'

export const runtime = 'edge'

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

  // Optional: Also clear history for current month? Usually history should stay.
  // We'll keep history as an audit trail.

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

export async function getUsageHistory(year: number, month: number) {
  const start = startOfMonth(new Date(year, month - 1)).toISOString()
  const end = endOfMonth(new Date(year, month - 1)).toISOString()

  const { data, error } = await supabase
    .from('parking_usage_history')
    .select('*')
    .gte('used_at', start)
    .lte('used_at', end)
    .order('used_at', { ascending: true })

  if (error) {
    console.error('Error fetching history:', error)
    return []
  }

  return data || []
}