'use server'

import { supabase } from '@/lib/supabaseClient'
import { revalidatePath } from 'next/cache'

export async function useParkingCard(id: number) {
  const { data, error } = await supabase
    .from('parking_cards')
    .select('remaining_uses')
    .eq('id', id)
    .single()

  if (error || !data) {
    console.error('Error fetching card:', error)
    return { success: false, error: '카드 정보를 가져오는 데 실패했습니다.' }
  }

  if (data.remaining_uses <= 0) {
    return { success: false, error: '남은 횟수가 없습니다.' }
  }

  const { error: updateError } = await supabase
    .from('parking_cards')
    .update({ 
      remaining_uses: data.remaining_uses - 1,
      last_used_at: new Date().toISOString()
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
  const { error } = await supabase
    .from('parking_cards')
    .update({ remaining_uses: 3 })
    .neq('id', 0) // Update all

  if (error) {
    console.error('Error resetting cards:', error)
    return { success: false, error: '초기화 중 오류가 발생했습니다.' }
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
