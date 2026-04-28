import { useState, useEffect } from 'react';
import { fetchCampaigns, fetchCampaignById, DbCampaign, supabase } from '@/lib/supabase';
import { Campaign } from '@/lib/index';
import { ethers } from 'ethers';
import { CROWDFUNDING_ABI, CONTRACT_ADDRESSES } from '@/context/Web3Context';

// Map DB row to frontend Campaign type
export function dbCampaignToFrontend(c: DbCampaign): Campaign {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    shortDescription: c.short_description,
    category: c.category,
    goalAmount: Number(c.goal_amount),
    currentAmount: Number(c.current_amount),
    donorCount: c.donor_count,
    image: c.image_url ?? 'https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&q=80&w=800',
    endDate: c.end_date,
    onChainId: c.on_chain_id ?? null,
    organizer: {
      id: c.organizer_id ?? 'platform',
      name: c.profiles?.name ?? 'Fundy Platform',
      avatar: c.profiles?.avatar_url ?? undefined,
      isVerified: c.profiles?.is_verified ?? false,
    },
    status: c.status,
  };
}

// ── Helper: silently mark a campaign expired in Supabase ──────
async function markCampaignExpired(campaignId: string) {
  try {
    await supabase
      .from('campaigns')
      .update({ status: 'expired' })
      .eq('id', campaignId);
    console.log(`[useCampaign] Campaign ${campaignId} marked as expired`);
  } catch (err) {
    console.error('[useCampaign] Failed to mark expired:', err);
  }
}

// ── Helper: check on-chain if goal was reached ────────────────
async function isGoalReachedOnChain(onChainId: number): Promise<boolean> {
  try {
    // Use window.ethereum if available (read-only check, no wallet needed)
    const ethereum = (window as any).ethereum;
    if (!ethereum) return false;

    const provider = new ethers.BrowserProvider(ethereum);
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES.crowdfunding,
      CROWDFUNDING_ABI,
      provider
    );

    const c = await contract.getCampaign(onChainId);
    return (c.totalRaisedEth + c.totalRaisedFdy) >= c.goalAmount;
  } catch {
    return false; // if chain unreachable, assume not reached → mark expired
  }
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;

    const timeout = setTimeout(() => {
      if (!stale) {
        setIsLoading(false);
        setError('Request timed out. Check your Supabase connection.');
      }
    }, 10_000);

    fetchCampaigns()
      .then((data) => {
        if (!stale) {
          const mapped = data.map(dbCampaignToFrontend);
          setCampaigns(mapped);

          // ── Check each active campaign for expiry ──────────
          const now = new Date();
          mapped.forEach(async (campaign) => {
            if (campaign.status !== 'active') return;
            if (now < new Date(campaign.endDate)) return; // not expired yet

            // Past deadline — check on-chain goal before marking expired
            if (campaign.onChainId) {
              const goalReached = await isGoalReachedOnChain(campaign.onChainId);
              if (goalReached) return; // organizer still needs to withdraw
            }

            await markCampaignExpired(campaign.id);

            // Update local state so UI reflects immediately without refetch
            if (!stale) {
              setCampaigns(prev =>
                prev.map(c => c.id === campaign.id ? { ...c, status: 'expired' } : c)
              );
            }
          });
        }
      })
      .catch((err) => {
        if (!stale) {
          console.error('[Supabase] fetchCampaigns error:', err);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!stale) {
          clearTimeout(timeout);
          setIsLoading(false);
        }
      });

    return () => {
      stale = true;
      clearTimeout(timeout);
    };
  }, []);

  return { campaigns, isLoading, error };
}

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rewardTiers, setRewardTiers] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    let stale = false;

    setIsLoading(true);
    setRewardTiers([]);

    const timeout = setTimeout(() => {
      if (!stale) {
        setIsLoading(false);
        setError('Request timed out. Check your Supabase connection.');
      }
    }, 10_000);

    Promise.all([
      fetchCampaignById(id),
      supabase
        .from('reward_tiers')
        .select('*')
        .eq('campaign_id', id)
        .order('min_amount', { ascending: true }),
    ])
      .then(async ([campaignData, { data: tiers, error: tiersError }]) => {
        if (stale) return;

        const mapped = dbCampaignToFrontend(campaignData);

        // ── Expiry check for this single campaign ─────────────
        if (mapped.status === 'active' && new Date() >= new Date(mapped.endDate)) {
          let shouldMarkExpired = true;

          if (mapped.onChainId) {
            const goalReached = await isGoalReachedOnChain(mapped.onChainId);
            if (goalReached) shouldMarkExpired = false; // awaiting organizer withdrawal
          }

          if (shouldMarkExpired && !stale) {
            await markCampaignExpired(mapped.id);
            mapped.status = 'expired'; // update local object immediately
          }
        }
        // ─────────────────────────────────────────────────────

        if (!stale) {
          setCampaign(mapped);

          if (tiersError) {
            console.error('[useCampaign] reward_tiers error:', tiersError.message);
            setRewardTiers([]);
          } else {
            setRewardTiers(
              (tiers ?? []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                minAmount: Number(t.min_amount),
                type: t.type,
                quantity: t.quantity ?? null,
                tokenAmount: t.token_amount ?? null,
                isPhysical: t.is_physical ?? false,
              })),
            );
          }
        }
      })
      .catch((err) => {
        if (!stale) {
          console.error('[useCampaign] error:', err.message);
          setError(err.message);
        }
      })
      .finally(() => {
        if (!stale) {
          clearTimeout(timeout);
          setIsLoading(false);
        }
      });

    return () => {
      stale = true;
      clearTimeout(timeout);
    };
  }, [id]);

  return { campaign, isLoading, error, rewardTiers };
}