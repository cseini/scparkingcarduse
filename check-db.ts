import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

async function check() {
  console.log("🔍 [1] '세인' 프로필 정보 조회 중...");
  const { data: profiles } = await supabase.from('profiles').select('id, name').eq('name', '세인');
  console.log("세인 프로필:", profiles);

  console.log("\n🔍 [2] 전체 구독 정보 및 연결된 프로필 조회 중...");
  const { data: subs, error } = await supabase
    .from('parking_push_subscriptions')
    .select('id, profile_id, created_at, profiles(name)')
    .order('created_at', { ascending: false });
  
  if (error) console.error("에러:", error);
  console.table(subs?.map(s => ({
    id: s.id,
    profile_id: s.profile_id,
    profile_name: (s as any).profiles?.name || '연결 안됨',
    created_at: s.created_at
  })));
}

check();
