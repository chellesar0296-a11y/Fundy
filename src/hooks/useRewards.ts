import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Reward, RewardStatus, CreditScore } from '@/lib/index';

// ── Map DB row → frontend Reward type ────────────────────────
function mapDbReward(row: any): Reward {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignTitle: row.campaigns?.title ?? 'Unknown Campaign',
    donorId: row.donor_id,
    type: row.type,
    name: row.name,
    description: row.description ?? '',
    imageUrl: row.image_url ?? undefined,
    tokenAmount: row.token_amount ?? undefined,
    tokenId: row.token_id ?? undefined,
    contractAddress: row.contract_address ?? undefined,
    status: row.status as RewardStatus,
    mintedAt: row.minted_at ?? undefined,
    claimedAt: row.claimed_at ?? undefined,
    createdAt: row.created_at,
  };
}

// ── Credit score computed from real donation data ─────────────
function computeCreditScore(
  totalDonated: number,
  campaignsSupported: number,
  donationCount: number,
): CreditScore {
  const raw = Math.min(1000, totalDonated * 2 + campaignsSupported * 50);
  let level: CreditScore['level'] = 'Bronze';
  if (raw >= 750) level = 'Platinum';
  else if (raw >= 500) level = 'Gold';
  else if (raw >= 200) level = 'Silver';
  return {
    score: raw,
    level,
    totalDonations: totalDonated,
    campaignsSupported,
    streakDays: Math.min(30, donationCount * 2),
  };
}

export function useRewards(userId: string | undefined) {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [creditScore, setCreditScore] = useState<CreditScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);

    // Fetch rewards joined with campaign title
    const rewardsPromise = supabase
      .from('rewards')
      .select('*, campaigns(title)')
      .eq('donor_id', userId)
      .order('created_at', { ascending: false });

    // Fetch real donation stats for credit score
    const donationsPromise = supabase
      .from('donations')
      .select('amount, campaign_id')
      .eq('donor_id', userId);

    Promise.all([rewardsPromise, donationsPromise])
      .then(([{ data: rewardRows, error: rewardErr }, { data: donationRows, error: donationErr }]) => {
        // ── Rewards ──
        if (rewardErr || !rewardRows) {
          console.error('[useRewards] rewards fetch error:', rewardErr?.message);
          setRewards([]);
        } else {
          setRewards(rewardRows.map(mapDbReward));
        }

        // ── Credit score from real donations ──
        if (!donationErr && donationRows && donationRows.length > 0) {
          const totalDonated = donationRows.reduce((sum, d) => sum + Number(d.amount), 0);
          const uniqueCampaigns = new Set(donationRows.map((d) => d.campaign_id)).size;
          setCreditScore(computeCreditScore(totalDonated, uniqueCampaigns, donationRows.length));
        } else {
          setCreditScore(computeCreditScore(0, 0, 0));
        }
      })
      .finally(() => setIsLoading(false));
  }, [userId]);

  // Claim reward — write to DB and update local state optimistically
  const claimReward = useCallback(async (rewardId: string) => {
    const claimedAt = new Date().toISOString();

    // Optimistic update
    setRewards((prev) =>
      prev.map((r) =>
        r.id === rewardId ? { ...r, status: 'claimed' as RewardStatus, claimedAt } : r
      )
    );

    // Persist to DB
    const { error } = await supabase
      .from('rewards')
      .update({ status: 'claimed', claimed_at: claimedAt })
      .eq('id', rewardId);

    if (error) {
      console.error('[useRewards] claimReward error:', error.message);
      // Rollback on failure
      setRewards((prev) =>
        prev.map((r) =>
          r.id === rewardId ? { ...r, status: 'minted' as RewardStatus, claimedAt: undefined } : r
        )
      );
      throw error;
    }
  }, []);

  const pendingCount = rewards.filter((r) => r.status === 'pending').length;
  const mintedCount = rewards.filter((r) => r.status === 'minted').length;

  return { rewards, creditScore, isLoading, claimReward, pendingCount, mintedCount };
}
