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
  wallet_address: string | null;
  // Verification fields
  is_verified: boolean | null;
  verification_status: 'none' | 'pending' | 'approved' | 'rejected' | null;
  created_at: string;
}

export interface DbCampaign {
  id: string;
  title: string;
  slug: string;
  description: string;
  short_description: string;
  category: 'Medical' | 'Education' | 'Environment' | 'Disaster' | 'Community'
    | 'Personal' | 'Creative' | 'Technology' | 'Business' | 'Animals' | 'Sports';
  goal_amount: number;
  current_amount: number;
  donor_count: number;
  image_url: string | null;
  end_date: string;
  organizer_id: string | null;
  status: 'active' | 'completed' | 'draft' | 'cancelled';
  on_chain_id: number | null;
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

// ── Verification request type ─────────────────────────────────

export interface DbVerificationRequest {
  id: string;
  user_id: string;
  full_name: string;
  id_type: string;
  id_number: string;
  document_url: string | null;
  selfie_url: string | null;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  updated_at: string | null;
  profiles?: DbProfile;
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
  image_url?: string | null;
}) {
  const { data: update, error } = await supabase
    .from('campaign_updates')
    .insert([{ ...data, created_at: new Date().toISOString() }])
    .select()
    .single();
  
  if (error) throw error;
  return update;
}

// ── Storage helpers ───────────────────────────────────────────

/**
 * Upload a file to Supabase Storage.
 * Bucket must exist — create "campaign-media" bucket in Supabase Dashboard → Storage.
 * @param file      File to upload
 * @param folder    Folder inside the bucket (e.g. campaign id)
 * @returns Public URL of the uploaded file
 */
export async function uploadMedia(file: File, folder: string): Promise<string> {
  const ext      = file.name.split('.').pop();
  const filename = `${folder}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('campaign-media')
    .upload(filename, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage
    .from('campaign-media')
    .getPublicUrl(filename);

  return data.publicUrl;
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

// ── Verification helpers ──────────────────────────────────────

export async function submitVerificationRequest(request: {
  user_id: string;
  full_name: string;
  id_type: string;
  id_number: string;
  document_url?: string | null;
  selfie_url?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from('verification_requests')
    .insert({
      ...request,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data as DbVerificationRequest;
}

export async function fetchVerificationRequests() {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*, profiles(name, email, avatar_url)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as DbVerificationRequest[];
}

export async function fetchUserVerificationRequest(userId: string) {
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DbVerificationRequest | null;
}

export async function processVerificationRequest(
  requestId: string,
  action: 'approved' | 'rejected',
  adminNote?: string,
  userId?: string,
) {
  // Update the request status
  const { error: reqError } = await supabase
    .from('verification_requests')
    .update({
      status: action,
      admin_note: adminNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (reqError) throw reqError;

  // If approved, update the profile is_verified flag
  if (action === 'approved' && userId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_verified: true,
        verification_status: 'approved',
      })
      .eq('id', userId);
    if (profileError) throw profileError;
  } else if (action === 'rejected' && userId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        verification_status: 'rejected',
      })
      .eq('id', userId);
    if (profileError) throw profileError;
  }
}

// ── Report helpers ────────────────────────────────────────────

export interface DbReport {
  id: string;
  campaign_id: string;
  reporter_id: string | null;
  reason_type: 'spam' | 'fraud' | 'inappropriate' | 'other';
  reason_detail: string | null;
  status: 'pending' | 'reviewed' | 'dismissed';
  created_at: string;
  campaigns?: DbCampaign;
  profiles?: DbProfile;
}

export async function submitReport(report: {
  campaign_id: string;
  reporter_id?: string | null;
  reason_type: DbReport['reason_type'];
  reason_detail?: string | null;
}) {
  const { data, error } = await supabase
    .from('reports')
    .insert({ ...report, status: 'pending', created_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as DbReport;
}

export async function fetchReports() {
  const { data, error } = await supabase
    .from('reports')
    .select('*, campaigns(title, organizer_id), profiles:reporter_id(name, email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as DbReport[];
}

export async function updateReportStatus(reportId: string, status: DbReport['status']) {
  const { error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', reportId);
  if (error) throw error;
}

// ── Cancel campaign with reason + email ───────────────────────

export async function cancelCampaignWithReason(
  campaignId: string,
  reason: string,
  organizerEmail: string,
  campaignTitle: string,
) {
  // 1. Update campaign status
  const { error } = await supabase
    .from('campaigns')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', campaignId);
  if (error) throw error;

  // 2. Send email via Supabase Edge Function
  try {
    await supabase.functions.invoke('send-email', {
      body: {
        to: organizerEmail,
        subject: `Your campaign "${campaignTitle}" has been cancelled`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#ef4444">Campaign Cancelled</h2>
            <p>Hi,</p>
            <p>Your campaign <strong>"${campaignTitle}"</strong> has been reviewed by our team and has been cancelled for the following reason:</p>
            <blockquote style="border-left:4px solid #ef4444;padding:12px 16px;background:#fef2f2;border-radius:4px;margin:16px 0">
              ${reason}
            </blockquote>
            <p>If you believe this was a mistake, please contact our support team.</p>
            <p style="color:#6b7280;font-size:14px">— The Fundy Team</p>
          </div>
        `,
      },
    });
  } catch (emailErr) {
    // Email failure should not block the cancel action
    console.error('[send-email] failed:', emailErr);
  }
}

// ── Wallet binding ────────────────────────────────────────────

export async function bindWalletAddress(userId: string, walletAddress: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ wallet_address: walletAddress })
    .eq('id', userId);
  if (error) throw error;
}

// ── Cancel Requests ───────────────────────────────────────────
// Organizers submit a cancel request with a reason.
// Admin can approve (→ cancels campaign + notifies organizer) or reject.
// FDY tokens are NOT refunded — only ETH donations are refundable on-chain.

export interface DbCancelRequest {
  id: string;
  campaign_id: string;
  organizer_id: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string | null;
  // joined
  campaigns?: DbCampaign;
  profiles?: DbProfile;
}

/** Organizer: submit a cancel request for their campaign. */
export async function submitCancelRequest(
  campaignId: string,
  organizerId: string,
  reason: string,
): Promise<DbCancelRequest> {
  // Prevent duplicate pending requests
  const { data: existing } = await supabase
    .from('cancel_requests')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existing) throw new Error('A cancel request is already pending for this campaign.');

  const { data, error } = await supabase
    .from('cancel_requests')
    .insert({
      campaign_id: campaignId,
      organizer_id: organizerId,
      reason,
      status: 'pending',
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as DbCancelRequest;
}

/** Admin: fetch all cancel requests. */
export async function fetchCancelRequests(): Promise<DbCancelRequest[]> {
  const { data, error } = await supabase
    .from('cancel_requests')
    .select('*, campaigns(title, organizer_id, on_chain_id, status), profiles:organizer_id(name, email)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as DbCancelRequest[];
}

/** Organizer: fetch their own campaign's cancel request. */
export async function fetchMyCancelRequest(campaignId: string): Promise<DbCancelRequest | null> {
  const { data, error } = await supabase
    .from('cancel_requests')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as DbCancelRequest | null;
}

/**
 * Admin: approve or reject a cancel request.
 * On approval, also sets campaign status = 'cancelled' and sends email.
 * The admin still needs to call cancelCampaignOnChain() from the UI after approving.
 */
export async function processCancelRequest(
  requestId: string,
  campaignId: string,
  action: 'approved' | 'rejected',
  reviewerId: string,
  adminNote?: string,
  organizerEmail?: string,
  campaignTitle?: string,
): Promise<void> {
  // Update request status
  const { error: reqErr } = await supabase
    .from('cancel_requests')
    .update({
      status: action,
      admin_note: adminNote ?? null,
      reviewed_by: reviewerId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);
  if (reqErr) throw reqErr;

  if (action === 'approved') {
    // Mark campaign as cancelled in DB
    const { error: campErr } = await supabase
      .from('campaigns')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
    if (campErr) throw campErr;

    // Notify organizer
    if (organizerEmail && campaignTitle) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: organizerEmail,
            subject: `Your cancel request for "${campaignTitle}" was approved`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                <h2 style="color:#ef4444">Campaign Cancelled</h2>
                <p>Your request to cancel <strong>"${campaignTitle}"</strong> has been approved.</p>
                ${adminNote ? `<blockquote style="border-left:4px solid #ef4444;padding:12px 16px;background:#fef2f2;border-radius:4px;margin:16px 0">${adminNote}</blockquote>` : ''}
                <p>Donors will be able to claim ETH refunds on-chain. FDY tokens already earned are kept.</p>
                <p style="color:#6b7280;font-size:14px">— The Fundy Team</p>
              </div>
            `,
          },
        });
      } catch (emailErr) {
        console.error('[send-email] failed:', emailErr);
      }
    }
  } else {
    // Notify organizer of rejection
    if (organizerEmail && campaignTitle) {
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            to: organizerEmail,
            subject: `Your cancel request for "${campaignTitle}" was rejected`,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                <h2 style="color:#f59e0b">Cancel Request Rejected</h2>
                <p>Your request to cancel <strong>"${campaignTitle}"</strong> has been reviewed and rejected.</p>
                ${adminNote ? `<blockquote style="border-left:4px solid #f59e0b;padding:12px 16px;background:#fffbeb;border-radius:4px;margin:16px 0">${adminNote}</blockquote>` : ''}
                <p>Your campaign remains active. If you have further concerns, please contact support.</p>
                <p style="color:#6b7280;font-size:14px">— The Fundy Team</p>
              </div>
            `,
          },
        });
      } catch (emailErr) {
        console.error('[send-email] failed:', emailErr);
      }
    }
  }
}
