import { useState, useEffect } from 'react';
import { fetchCampaigns, fetchCampaignById, DbCampaign } from '@/lib/supabase';
import { Campaign } from '@/lib/index';

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
    organizer: {
      id: c.organizer_id ?? 'platform',
      name: c.profiles?.name ?? 'Fundy Platform',
      avatar: c.profiles?.avatar_url ?? undefined,
      isVerified: true,
    },
    status: c.status,
  };
}

export function useCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns()
      .then((data) => setCampaigns(data.map(dbCampaignToFrontend)))
      .catch((err) => {
        console.error('[Supabase] fetchCampaigns error:', err);
        setError(err.message);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return { campaigns, isLoading, error };
}

export function useCampaign(id: string) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetchCampaignById(id)
      .then((data) => setCampaign(dbCampaignToFrontend(data)))
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [id]);

  return { campaign, isLoading, error };
}
