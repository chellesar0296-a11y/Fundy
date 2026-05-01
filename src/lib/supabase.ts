import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://enbtaxbnlejzxuyuugla.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVuYnRheGJubGVqenh1eXV1Z2xhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTk0MDgsImV4cCI6MjA5MDk5NTQwOH0.rxgk10frLLCIb9vdA1ygNfB4Yca8qwf5zpjSVxBcRLQ';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
    },
  },
});

async function dbFetch(path: string, method = 'GET', body?: object) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=representation',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? `DB error ${res.status}`);
  return json;
}
async function invokeFn(fnName: string, body: object) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Email failures are non-fatal — log and continue
    console.error(`[invokeFn:${fnName}] failed:`, err);
  }
}
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
  status: 'active' | 'completed' | 'draft' | 'cancelled' | 'expired';
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
  console.log('Creating campaign update with data:', { ...data, image_url: data.image_url || 'null' });

  const { data: update, error } = await supabase
    .from('campaign_updates')
    .insert({
      campaign_id: data.campaign_id,
      title: data.title,
      content: data.content,
      author_id: data.author_id,
      author_name: data.author_name,
      image_url: data.image_url || null,
      // ❌ REMOVE THIS LINE:
      // created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase error details:', error);
    throw new Error(`Failed to create update: ${error.message}`);
  }

  console.log('Update created successfully:', update);
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
  console.log('Starting uploadMedia...', { fileName: file.name, fileSize: file.size, folder });

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size must be under 5MB');
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, GIF, and WEBP images are allowed');
  }

  const ext = file.name.split('.').pop();
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

  console.log('Uploading to path:', filename);

  // JUST THIS - no Promise.race
  const { data, error } = await supabase.storage
    .from('campaign-media')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    console.error('Upload error:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('campaign-media')
    .getPublicUrl(filename);

  console.log('Public URL:', publicUrl);
  return publicUrl;
}

export async function getCampaignUpdates(campaignId: string) {
  console.log('Fetching updates for campaign:', campaignId);

  const { data, error } = await supabase
    .from('campaign_updates')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching updates:', error);
    throw error;
  }

  console.log(`Fetched ${data?.length || 0} updates`);
  return data || [];
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
    status?: string;
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
export async function fetchVerificationRequests(): Promise<DbVerificationRequest[]> {
  console.log('🔄 Fetching verification requests...');

  const { data, error } = await supabase
    .from('verification_requests')
    .select(`
      *,
      profiles (
        name,
        email,
        avatar_url
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching verification requests:', error);
    return [];
  }

  console.log('✅ Fetched verification requests:', data?.length);
  return (data ?? []) as DbVerificationRequest[];
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
): Promise<void> {
  console.log('🔄 Processing verification request:', requestId, action);

  // 1. Update verification_requests row using Supabase client
  const { error: requestError } = await supabase
    .from('verification_requests')
    .update({
      status: action,
      admin_note: adminNote ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId);

  if (requestError) {
    console.error('❌ Error updating verification request:', requestError);
    throw requestError;
  }
  console.log('✅ Verification request updated');

  // 2. Update profiles
  if (userId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update(
        action === 'approved'
          ? { is_verified: true, verification_status: 'approved' }
          : { verification_status: 'rejected' }
      )
      .eq('id', userId);

    if (profileError) {
      console.error('❌ Error updating profile:', profileError);
      throw profileError;
    }
    console.log('✅ Profile updated');
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
  const { error } = await supabase
    .from('reports')
    .insert({ ...report, status: 'pending', created_at: new Date().toISOString() });
  if (error) throw error;
}

export async function fetchReports(): Promise<DbReport[]> {
  console.log('🔄 Fetching reports with Supabase client...');

  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      campaigns (
        title,
        organizer_id
      ),
      profiles!reporter_id (
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching reports:', error);
    return [];
  }

  console.log('✅ Fetched reports:', data?.length);
  return (data ?? []) as DbReport[];
}

export async function updateReportStatus(
  reportId: string,
  status: DbReport['status'],
): Promise<void> {
  console.log('🔄 Updating report status:', reportId, status);

  const { error } = await supabase
    .from('reports')
    .update({ status })
    .eq('id', reportId);

  if (error) {
    console.error('❌ Error updating report:', error);
    throw error;
  }

  console.log('✅ Report status updated');
}

// ── Cancel campaign with reason + email ───────────────────────

export async function cancelCampaignWithReason(
  campaignId: string,
  reason: string,
  organizerEmail: string,
  campaignTitle: string,
): Promise<void> {
  console.log('=== cancelCampaignWithReason START ===');
  console.log('Campaign ID:', campaignId);
  console.log('Reason:', reason);

  try {
    // 1. Cancel campaign using Supabase client
    const { error: campaignError } = await supabase
      .from('campaigns')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId);

    if (campaignError) {
      console.error('❌ Campaign update error:', campaignError);
      throw campaignError;
    }
    console.log('✅ Campaign cancelled in database');

    // 2. Get organizer_id
    const { data: campaignData, error: fetchError } = await supabase
      .from('campaigns')
      .select('organizer_id')
      .eq('id', campaignId)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching campaign:', fetchError);
    }

    // 3. In-app notify organizer
    if (campaignData?.organizer_id) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: campaignData.organizer_id,
          type: 'campaign_cancelled',
          title: 'Campaign Cancelled by Admin',
          message: `Your campaign "${campaignTitle}" has been cancelled due to policy violations or reports. Please contact support if you believe this is a mistake.`,
          campaign_id: campaignId,
          is_read: false,
          email_sent: false,
        });

      if (notifError) {
        console.error('❌ Notification error:', notifError);
      } else {
        console.log('✅ Notification sent to organizer');
      }
    }

    // 4. Get donors for notifications
    const { data: donations, error: donationsError } = await supabase
      .from('donations')
      .select('donor_id')
      .eq('campaign_id', campaignId)
      .not('donor_id', 'is', null);

    if (donationsError) {
      console.error('❌ Error fetching donations:', donationsError);
    }

    if (donations && donations.length > 0) {
      const uniqueDonorIds = [...new Set(donations.map((d: any) => d.donor_id))];

      const { error: donorNotifError } = await supabase
        .from('notifications')
        .insert(
          uniqueDonorIds.map((donorId) => ({
            user_id: donorId,
            type: 'campaign_cancelled',
            title: 'Campaign Cancelled Due to Safety Concerns',
            message: `The campaign "${campaignTitle}" was cancelled after review. Refunds have been automatically processed to your wallet.`,
            campaign_id: campaignId,
            is_read: false,
            email_sent: false,
          }))
        );

      if (donorNotifError) {
        console.error('❌ Donor notification error:', donorNotifError);
      } else {
        console.log('✅ Notifications sent to donors');
      }
    }

    // 5. Email organizer (non-fatal)
    if (organizerEmail && campaignTitle) {
      await invokeFn('send-email', {
        to: organizerEmail,
        subject: `Your campaign "${campaignTitle}" has been cancelled`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
            <h2 style="color:#ef4444">Campaign Cancelled</h2>
            <p>Hi,</p>
            <p>Your campaign <strong>"${campaignTitle}"</strong> has been reviewed and cancelled for the following reason:</p>
            <blockquote style="border-left:4px solid #ef4444;padding:12px 16px;background:#fef2f2;border-radius:4px;margin:16px 0">${reason}</blockquote>
            <p>If you believe this was a mistake, please contact our support team.</p>
            <p style="color:#6b7280;font-size:14px">— The Fundy Team</p>
          </div>
        `,
      });
      console.log('✅ Email sent to organizer');
    }

    // 6. Email donors (non-fatal, fire-and-forget)
    if (donations && donations.length > 0 && campaignTitle) {
      // Get donor profiles with emails
      const donorIds = [...new Set(donations.map((d: any) => d.donor_id))];

      const { data: donorProfiles, error: donorError } = await supabase
        .from('profiles')
        .select('email, name')
        .in('id', donorIds);

      if (!donorError && donorProfiles) {
        const contacts = donorProfiles.map((profile: any) => ({
          email: profile.email,
          name: profile.name ?? 'Donor',
        }));

        await Promise.allSettled(
          contacts.map(({ email, name }) =>
            invokeFn('send-email', {
              to: email,
              subject: `Update: "${campaignTitle}" has been cancelled`,
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                  <h2 style="color:#ef4444">Campaign Cancelled Due to Safety Concerns</h2>
                  <p>Hi ${name},</p>
                  <p>A campaign you donated to — <strong>"${campaignTitle}"</strong> — has been cancelled by our admin team.</p>
                  <blockquote style="border-left:4px solid #ef4444;padding:12px 16px;background:#fef2f2;border-radius:4px;margin:16px 0">${reason}</blockquote>
                  <p>The campaign was cancelled after review. Refunds have been automatically processed to your wallet.</p>
                  <p style="color:#6b7280;font-size:14px">— The Fundy Team</p>
                </div>
              `,
            })
          )
        );
        console.log('✅ Emails sent to donors');
      }
    }

    console.log('=== cancelCampaignWithReason COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('❌ Error in cancelCampaignWithReason:', error);
    throw error;
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
  console.log('🔄 Fetching cancel requests with Supabase client...');

  const { data, error } = await supabase
    .from('cancel_requests')
    .select(`
      *,
      campaigns (
        title,
        organizer_id,
        on_chain_id,
        status
      ),
      profiles!cancel_requests_organizer_id_fkey (
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching cancel requests:', error);
    return [];
  }

  console.log('✅ Fetched cancel requests:', data?.length);
  return (data ?? []) as DbCancelRequest[];
}

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

export async function processCancelRequest(
  requestId: string,
  campaignId: string,
  action: 'approved' | 'rejected',
  reviewerId: string,
  adminNote?: string,
  organizerEmail?: string,
  campaignTitle?: string,
): Promise<void> {
  console.log('=== processCancelRequest START ===');
  console.log('Request ID:', requestId);
  console.log('Action:', action);

  try {
    // 1. Update cancel_requests using Supabase client
    const { error: updateError } = await supabase
      .from('cancel_requests')
      .update({
        status: action,
        admin_note: adminNote ?? null,
        reviewed_by: reviewerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ Update error:', updateError);
      throw updateError;
    }
    console.log('✅ Cancel request updated');

    if (action === 'approved') {
      // 2. Update campaign status to cancelled
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId);

      if (campaignError) {
        console.error('❌ Campaign update error:', campaignError);
      } else {
        console.log('✅ Campaign updated to cancelled');
      }

      // 3. Get organizer_id for notifications
      const { data: campaignData } = await supabase
        .from('campaigns')
        .select('organizer_id')
        .eq('id', campaignId)
        .single();

      // 4. Send notifications (keeping your existing notification code)
      if (campaignData?.organizer_id && campaignTitle) {
        await supabase.from('notifications').insert({
          user_id: campaignData.organizer_id,
          type: 'campaign_cancelled',
          title: 'Your Cancel Request Was Approved',
          message: `Your request to cancel "${campaignTitle}" has been approved. The campaign is now closed.`,
          campaign_id: campaignId,
          is_read: false,
          email_sent: false,
        });
        console.log('✅ Notification sent to organizer');
      }

      // 5. Email organizer (keep your existing email code)
      if (organizerEmail && campaignTitle) {
        await invokeFn('send-email', {
          to: organizerEmail,
          subject: `Your cancel request for "${campaignTitle}" was approved`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
              <h2 style="color:#ef4444">Campaign Cancelled</h2>
              <p>Your request to cancel <strong>"${campaignTitle}"</strong> has been approved.</p>
              ${adminNote ? `<blockquote style="border-left:4px solid #ef4444;padding:12px 16px;background:#fef2f2;border-radius:4px;margin:16px 0">${adminNote}</blockquote>` : ''}
              <p>Donors will be able to claim ETH refunds on-chain.</p>
              <p style="color:#6b7280;font-size:14px">— The Fundy Team</p>
            </div>
          `,
        });
        console.log('✅ Email sent to organizer');
      }
    } else {
      // For rejected requests, send rejection notification
      if (organizerEmail && campaignTitle) {
        await invokeFn('send-email', {
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
        });
        console.log('✅ Rejection email sent');
      }
    }

    console.log('=== processCancelRequest COMPLETED SUCCESSFULLY ===');
  } catch (error) {
    console.error('❌ Error in processCancelRequest:', error);
    throw error;
  }
}