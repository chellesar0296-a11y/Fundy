import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://enbtaxbnlejzxuyuugla.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYnRheGJubGVqenh1eXV1Z2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTk0MDgsImV4cCI6MjA5MDk5NTQwOH0.rxgk10frLLCIb9vdA1ygNfB4Yca8qwf5zpjSVxBcRLQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
    },
  },
});

// ── DB types ─────────────────────────────────────────────────

export interface DbProfile {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  role: 'admin' | 'donor' | 'organizer';
  created_at: string;
}

export interface DbCampaign {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  category: 'Medical' | 'Education' | 'Environment' | 'Disaster' | 'Community';
  goal_amount: number;
  current_amount: number;
  donor_count: number;
  image_url: string | null;
  end_date: string;
  organizer_id: string | null;
  status: 'active' | 'completed' | 'draft';
  created_at: string;
  profiles?: DbProfile;
}

export interface DbDonation {
  id: string;
  campaign_id: string;
  donor_id: string | null;
  donor_name: string;
  amount: number;
  message: string | null;
  is_anonymous: boolean;
  created_at: string;
  campaigns?: DbCampaign;
}

// ── Campaign helpers ──────────────────────────────────────────

export async function fetchCampaigns() {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, profiles(*)')
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as DbCampaign[];
}

export async function fetchCampaignById(id: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, profiles(*)')
    .or(`id.eq.${id},slug.eq.${id}`)
    .single();
  if (error) throw error;
  return data as DbCampaign;
}

export async function createCampaign(campaign: {
  title: string;
  slug: string;
  description: string;
  short_description: string;
  category: DbCampaign['category'];
  goal_amount: number;
  image_url?: string;
  end_date: string;
  organizer_id: string;
}) {
  const { data, error } = await supabase
    .from('campaigns')
    .insert(campaign)
    .select()
    .single();
  if (error) throw error;
  return data as DbCampaign;
}

// ── Donation helpers ──────────────────────────────────────────

export async function submitDonation(donation: {
  campaign_id: string;
  donor_id?: string;
  donor_name: string;
  amount: number;
  message?: string;
  is_anonymous?: boolean;
}) {
  const { data, error } = await supabase
    .from('donations')
    .insert(donation)
    .select()
    .single();
  if (error) throw error;
  return data as DbDonation;
}

export async function fetchUserDonations(userId: string) {
  const { data, error } = await supabase
    .from('donations')
    .select('*, campaigns(title, id, slug)')
    .eq('donor_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as (DbDonation & { campaigns: Pick<DbCampaign, 'title' | 'id' | 'slug'> })[];
}

export async function fetchUserCampaigns(organizerId: string) {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*, profiles(*)')
    .eq('organizer_id', organizerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as DbCampaign[];
}

export async function fetchUserRewards(userId: string) {
  const { data, error } = await supabase
    .from('rewards')
    .select('*, campaigns(title)')
    .eq('donor_id', userId)
    .order('created_at', { ascending: false })
    .limit(3);
  if (error) throw error;
  return data as (DbReward & { campaigns: Pick<DbCampaign, 'title'> })[];
}

export interface DbReward {
  id: string;
  campaign_id: string;
  donor_id: string;
  type: 'ERC20' | 'ERC721' | 'badge';
  name: string;
  description: string | null;
  image_url: string | null;
  token_amount: number | null;
  token_id: string | null;
  contract_address: string | null;
  status: 'pending' | 'minted' | 'claimed' | 'failed';
  minted_at: string | null;
  claimed_at: string | null;
  created_at: string;
}

export async function fetchCampaignDonations(campaignId: string) {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) throw error;
  return data as DbDonation[];
}

// ── Profile helpers ───────────────────────────────────────────

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as DbProfile;
}

export async function updateProfile(userId: string, updates: Partial<DbProfile>) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data as DbProfile;
}


export async function createCampaignUpdate(data: {
  campaign_id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
}) {
  const { data: update, error } = await supabase
    .from('campaign_updates')
    .insert([{ ...data, created_at: new Date().toISOString() }])
    .select()
    .single();
  
  if (error) throw error;
  return update;
}

export async function getCampaignUpdates(campaignId: string) {
  const { data, error } = await supabase
    .from('campaign_updates')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data;
}

export async function cancelCampaign(campaignId: string) {
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', campaignId);
  
  if (error) throw error;
}


export async function updateCampaign(
  campaignId: string,
  updates: {
    title?: string;
    short_description?: string;
    description?: string;
    category?: string;
    goal_amount?: number;
    image_url?: string | null;
    end_date?: string;
  }
) {
  const { data, error } = await supabase
    .from('campaigns')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
