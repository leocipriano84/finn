import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

const REWARD_CREDITS = 30

export async function processReferralReward(referredUserId) {
  const { data: referral } = await supabase
    .from('referrals').select('id, referrer_id, status')
    .eq('referred_id', referredUserId).eq('status', 'pending').single()
  if (!referral) return null
  await supabase.from('referrals').update({ status: 'converted', rewarded_at: new Date().toISOString() }).eq('id', referral.id)
  const { data: referrer } = await supabase.from('profiles').select('referral_credits').eq('id', referral.referrer_id).single()
  await supabase.from('profiles').update({ referral_credits: (referrer?.referral_credits || 0) + REWARD_CREDITS }).eq('id', referral.referrer_id)
  await supabase.from('referral_rewards').insert({ referral_id: referral.id, referrer_id: referral.referrer_id, credits: REWARD_CREDITS, type: 'conversion' })
  return { referrer_id: referral.referrer_id, credits: REWARD_CREDITS }
}
