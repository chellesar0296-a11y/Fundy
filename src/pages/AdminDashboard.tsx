import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, TrendingUp, ShieldAlert, CheckCircle2,
  Clock, Loader2, AlertTriangle, RefreshCw, Gift, Ban, Eye,
  ShieldCheck, XCircle, FileText, Flag, CheckCircle, Wallet,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  processVerificationRequest,
  cancelCampaignWithReason,
  updateReportStatus,
  fetchReports,
  fetchVerificationRequests,
  DbVerificationRequest,
  DbReport,
  fetchCancelRequests,
  processCancelRequest,
  DbCancelRequest,
} from '@/lib/supabase';
import { useWeb3 } from '@/context/Web3Context';


// ── Types ─────────────────────────────────────────────────────
interface AdminCampaign {
  id: string;
  title: string;
  status: string;
  current_amount: number;
  goal_amount: number;
  donor_count: number;
  organizer_name: string;
  organizer_email: string;
  organizer_verified: boolean;
  created_at: string;
  on_chain_id: number | null;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  joined: string;
  donation_count: number;
  is_verified: boolean;
  verification_status: string;
}

interface AdminReward {
  id: string;
  donor_name: string;
  campaign_title: string;
  type: string;
  status: string;
  token_amount: number | null;
}

// ── Supabase manual fetch helper ──────────────────────────────
const dbFetch = async (path: string, method: string = 'GET', body?: object) => {
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
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Request failed: ${res.status}`);
  }
  // DELETE returns 204 no content
  if (res.status === 204) return null;
  return res.json();
};

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ title, value, icon: Icon, color = 'text-primary', loading = false }: {
  title: string; value: string | number; icon: React.ElementType; color?: string; loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`p-3 rounded-xl bg-muted/40 ${color}`}><Icon className="w-6 h-6" /></div>
        <div>
          {loading
            ? <div className="h-7 w-16 bg-muted animate-pulse rounded mb-1" />
            : <p className="text-2xl font-extrabold">{value}</p>}
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Cancel Campaign Dialog ────────────────────────────────────
function CancelCampaignDialog({
  campaign, onClose, onCancelled,
}: {
  campaign: AdminCampaign | null;
  onClose: () => void;
  onCancelled: (id: string) => void;
}) {
  const { cancelCampaignOnChain, isConnected, connect } = useWeb3();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => { setReason(''); setConfirmed(false); }, [campaign?.id]);

  if (!campaign) return null;

  const handleCancel = async () => {
    if (!reason.trim()) { toast.error('Please provide a reason.'); return; }
    if (!confirmed) { toast.error('Please check the confirmation box.'); return; }
    setIsCancelling(true);
    try {
      // Step 1: cancel on-chain first → auto refunds ETH to all donors
      if (campaign.on_chain_id) {
        if (!isConnected) {
          toast.error('Please connect your wallet first');
          await connect();
          setIsCancelling(false);
          return;
        }
        try {
          await cancelCampaignOnChain(Number(campaign.on_chain_id));
          toast.success('On-chain cancel done — ETH refunded to donors!');
        } catch (chainErr: any) {
          // Check if it's a user rejection
          if (chainErr.code === 4001 ||
            chainErr.message?.includes('User rejected') ||
            chainErr.message?.includes('denied transaction signature')) {
            toast.error('Transaction cancelled - you rejected the signature request');
          } else {
            toast.error('Transaction failed: ' + (chainErr.message?.split('\n')[0] || 'unknown error'));
          }
          setIsCancelling(false);
          return;
        }
      }
      // Step 2: update DB + notify organizer by email
      await cancelCampaignWithReason(
        campaign.id,
        reason.trim(),
        campaign.organizer_email,
        campaign.title,
      );
      onCancelled(campaign.id);
      onClose();
      toast.success('Campaign cancelled. Organizer notified by email.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to cancel campaign');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <Dialog open={!!campaign} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="w-5 h-5" /> Cancel Campaign
          </DialogTitle>
          <DialogDescription>
            This will cancel <strong>"{campaign.title}"</strong> and send a notification email to the organizer at <strong>{campaign.organizer_email}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Reason for cancellation <span className="text-destructive">*</span>
            </label>
            <Textarea
              placeholder="e.g. This campaign was reported multiple times for fraudulent activity and has been reviewed by our team..."
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-destructive shrink-0"
            />
            <span className="text-sm text-muted-foreground">
              I confirm I have reviewed this campaign and understand this action <strong>cannot be undone</strong>.
            </span>
          </label>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleCancel}
              disabled={isCancelling || !reason.trim() || !confirmed}
            >
              {isCancelling
                ? <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Cancelling...
                </span>
                : 'Confirm Cancel & Notify'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Verification Review Dialog ────────────────────────────────
function VerificationDialog({
  request, onClose, onProcessed,
}: {
  request: DbVerificationRequest | null;
  onClose: () => void;
  onProcessed: (id: string, action: 'approved' | 'rejected', note: string) => void;
}) {
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { setAdminNote(''); }, [request?.id]);
  if (!request) return null;

  const handle = async (action: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      await processVerificationRequest(request.id, action, adminNote || undefined, request.user_id);
      onProcessed(request.id, action, adminNote);
      onClose();
      toast.success(action === 'approved' ? 'User verified successfully.' : 'Request rejected.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to process request');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Verification Request
          </DialogTitle>
          <DialogDescription>Review submitted documents and approve or reject.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Full Name', request.full_name],
              ['ID Type', request.id_type],
              ['ID Number', request.id_number],
              ['Submitted', new Date(request.created_at).toLocaleDateString()],
            ].map(([label, val]) => (
              <div key={label} className="p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="font-semibold">{val}</p>
              </div>
            ))}
          </div>
          {request.notes && (
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Applicant Notes</p>
              <p>{request.notes}</p>
            </div>
          )}
          <div className="flex gap-3">
            {request.document_url && (
              <a href={request.document_url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg text-sm hover:bg-muted/30 transition-colors">
                <FileText className="w-4 h-4" /> View Document
              </a>
            )}
            {request.selfie_url && (
              <a href={request.selfie_url} target="_blank" rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 p-3 border rounded-lg text-sm hover:bg-muted/30 transition-colors">
                <Eye className="w-4 h-4" /> View Selfie
              </a>
            )}
            {!request.document_url && !request.selfie_url && (
              <p className="text-xs text-muted-foreground italic">No documents uploaded.</p>
            )}
          </div>
          {request.status === 'pending' && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Admin Note (optional — shown to user)
              </label>
              <Textarea
                placeholder="e.g. Document was unclear, please resubmit with a clearer photo."
                rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
              />
            </div>
          )}
          {request.admin_note && request.status !== 'pending' && (
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Admin Note</p>
              <p className="text-sm">{request.admin_note}</p>
            </div>
          )}
          {request.status === 'pending' ? (
            <div className="flex gap-3 pt-1">
              <Button variant="outline"
                className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => handle('rejected')} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Reject
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handle('approved')} disabled={isProcessing}>
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve & Verify
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-1">
              <span className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${request.status === 'approved'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
                }`}>
                {request.status === 'approved'
                  ? <><CheckCircle2 className="w-4 h-4" /> Approved</>
                  : <><XCircle className="w-4 h-4" /> Rejected</>}
              </span>
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Cancel Request Review Dialog ─────────────────────────────
function CancelRequestReviewDialog({
  request,
  onClose,
  onProcessed,
}: {
  request: DbCancelRequest | null;
  onClose: () => void;
  onProcessed: (id: string, action: 'approved' | 'rejected') => void;
}) {
  const { user } = useAuth();
  const { cancelCampaignOnChain } = useWeb3();
  const [adminNote, setAdminNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => { setAdminNote(''); }, [request?.id]);
  if (!request) return null;

  const campaign = request.campaigns as any;
  const organizer = request.profiles as any;

  const handle = async (action: 'approved' | 'rejected') => {
    setIsProcessing(true);
    try {
      if (action === 'approved' && campaign?.on_chain_id) {
        try {
          console.log('🔄 Cancelling on-chain campaign:', campaign.on_chain_id);
          await cancelCampaignOnChain(Number(campaign.on_chain_id));
          console.log('✅ On-chain cancellation successful');
          toast.success('On-chain cancellation confirmed');
        } catch (chainErr: any) {
          console.error('❌ On-chain error:', chainErr);
          if (chainErr.code === 4001 ||
            chainErr.message?.includes('User rejected') ||
            chainErr.message?.includes('denied transaction signature')) {
            toast.error('Transaction cancelled - you rejected the signature');
          } else {
            toast.error('On-chain cancel failed: ' + (chainErr.message?.split('\n')[0] || 'unknown error'));
          }
          setIsProcessing(false);
          return;
        }
      }

      console.log('📝 Updating database...');
      await processCancelRequest(
        request.id,
        request.campaign_id,
        action,
        user!.id,
        adminNote || undefined,
        organizer?.email,
        campaign?.title,
      );
      console.log('✅ Database updated successfully');

      // IMPORTANT: Call onProcessed FIRST to refresh parent data
      await onProcessed(request.id, action);

      // THEN close the dialog
      onClose();

      toast.success(action === 'approved'
        ? 'Campaign cancellation request approved and processed!'
        : 'Cancel request rejected. Organizer notified.');
    } catch (err: any) {
      console.error('❌ Error in handle function:', err);
      toast.error(err.message ?? 'Failed to process request');
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <Dialog open={!!request} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-orange-500" /> Review Cancel Request
          </DialogTitle>
          <DialogDescription>
            Review the organizer's reason and approve or reject this cancellation.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['Campaign', campaign?.title ?? request.campaign_id],
              ['Organizer', organizer?.name ?? '—'],
              ['Organizer Email', organizer?.email ?? '—'],
              ['Submitted', new Date(request.created_at).toLocaleDateString()],
            ].map(([label, val]) => (
              <div key={label} className="p-3 bg-muted/40 rounded-lg col-span-1">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className="font-semibold text-xs">{val}</p>
              </div>
            ))}
          </div>
          <div className="p-3 bg-muted/40 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Organizer's Reason</p>
            <p className="whitespace-pre-wrap">{request.reason}</p>
          </div>
          {campaign?.on_chain_id && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Approving will call <strong>cancelCampaign(#{campaign.on_chain_id})</strong> on-chain.
                Donors will be able to claim ETH refunds. FDY tokens earned are kept.
                Make sure your wallet is connected as admin.
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Admin Note (sent to organizer by email)
            </label>
            <Textarea
              placeholder="Optional note to the organizer..."
              rows={2}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
          {request.status !== 'pending' && (
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Already {request.status}</p>
              {request.admin_note && <p className="text-xs">{request.admin_note}</p>}
            </div>
          )}
          {request.status === 'pending' && (
            <div className="flex gap-3 pt-1">
              <Button
                variant="outline"
                className="flex-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                onClick={() => handle('rejected')}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                Reject
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handle('approved')}
                disabled={isProcessing}
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                Approve & Cancel
              </Button>
            </div>
          )}
          {request.status !== 'pending' && (
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Role Toggle Confirm Dialog ────────────────────────────────
function RoleToggleConfirmDialog({
  user,
  onClose,
  onConfirmed,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onConfirmed: (user: AdminUser) => Promise<void>;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  if (!user) return null;
  const newRole = user.role === 'donor' ? 'organizer' : 'donor';

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirmed(user);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Change User Role
          </DialogTitle>
          <DialogDescription>
            You are about to change <strong>{user.name}</strong>'s role from{' '}
            <strong className="capitalize">{user.role}</strong> →{' '}
            <strong className="capitalize">{newRole}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="p-3 bg-muted/40 rounded-lg text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">{user.email}</p>
            <p>Joined {new Date(user.joined).toLocaleDateString()}</p>
            <p>{user.donation_count} donation{user.donation_count !== 1 ? 's' : ''}</p>
          </div>
          {newRole === 'organizer' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>Organizers can create and manage fundraising campaigns on the platform.</span>
            </div>
          )}
          {newRole === 'donor' && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <span>This user will lose organizer privileges and can no longer manage campaigns.</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={isProcessing}>
              {isProcessing
                ? <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating…
                </span>
                : `Set as ${newRole}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { cancelCampaignOnChain, addAdmin, isConnected, connect, address } = useWeb3();

  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [verifications, setVerifications] = useState<DbVerificationRequest[]>([]);
  const [reports, setReports] = useState<DbReport[]>([]);
  const [cancelRequests, setCancelRequests] = useState<DbCancelRequest[]>([]);

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingCancelRequests, setLoadingCancelRequests] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [selectedVerification, setSelectedVerification] = useState<DbVerificationRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminCampaign | null>(null);
  const [selectedCancelRequest, setSelectedCancelRequest] = useState<DbCancelRequest | null>(null);
  const [pendingReportId, setPendingReportId] = useState<string | null>(null);
  const [roleToggleTarget, setRoleToggleTarget] = useState<AdminUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'donor' | 'organizer' | 'admin'>('all');

  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalUsers: users.length,
    pendingRewards: rewards.filter(r => r.status === 'pending').length,
    pendingVerifications: verifications.filter(v => v.status === 'pending').length,
    pendingReports: reports.filter(r => r.status === 'pending').length,
    pendingCancelRequests: cancelRequests.filter(r => r.status === 'pending').length,
  };

  // ── Loaders ────────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const data = await dbFetch(
        'campaigns?select=id,title,status,current_amount,goal_amount,donor_count,created_at,on_chain_id,profiles(name,email,is_verified)&order=created_at.desc'
      );
      setCampaigns((data ?? []).map((c: any) => ({
        id: c.id,
        title: c.title,
        status: c.status,
        current_amount: Number(c.current_amount),
        goal_amount: Number(c.goal_amount),
        donor_count: c.donor_count,
        organizer_name: c.profiles?.name ?? '—',
        organizer_email: c.profiles?.email ?? '',
        organizer_verified: c.profiles?.is_verified ?? false,
        created_at: c.created_at,
        on_chain_id: c.on_chain_id ?? null,
      })));
    } catch (err: any) {
      toast.error('Failed to load campaigns: ' + err.message);
    } finally {
      setLoadingCampaigns(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const [profileData, donationData] = await Promise.all([
        dbFetch('profiles?select=id,name,email,role,created_at,is_verified,verification_status&order=created_at.desc'),
        dbFetch('donations?select=donor_id'),
      ]);

      const counts: Record<string, number> = {};
      (donationData ?? []).forEach((d: any) => {
        if (d.donor_id) counts[d.donor_id] = (counts[d.donor_id] ?? 0) + 1;
      });

      setUsers((profileData ?? []).map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        joined: u.created_at,
        donation_count: counts[u.id] ?? 0,
        is_verified: u.is_verified ?? false,
        verification_status: u.verification_status ?? 'none',
      })));
    } catch (err: any) {
      toast.error('Failed to load users: ' + err.message);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const loadRewards = useCallback(async () => {
    setLoadingRewards(true);
    try {
      const data = await dbFetch(
        'rewards?select=id,status,type,token_amount,campaigns(title),profiles:donor_id(name)&order=created_at.desc'
      );
      setRewards((data ?? []).map((r: any) => ({
        id: r.id,
        donor_name: r.profiles?.name ?? 'Unknown',
        campaign_title: r.campaigns?.title ?? '—',
        type: r.type,
        status: r.status,
        token_amount: r.token_amount ?? null,
      })));
    } catch (err: any) {
      toast.error('Failed to load rewards: ' + err.message);
    } finally {
      setLoadingRewards(false);
    }
  }, []);

  const loadVerifications = useCallback(async () => {
    setLoadingVerifications(true);
    try { setVerifications(await fetchVerificationRequests()); }
    catch { setVerifications([]); }
    finally { setLoadingVerifications(false); }
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try { setReports(await fetchReports()); }
    catch { setReports([]); }
    finally { setLoadingReports(false); }
  }, []);

  const loadCancelRequests = useCallback(async () => {
    setLoadingCancelRequests(true);
    try { setCancelRequests(await fetchCancelRequests()); }
    catch { setCancelRequests([]); }
    finally { setLoadingCancelRequests(false); }
  }, []);

  useEffect(() => {
    loadCampaigns(); loadUsers(); loadRewards(); loadVerifications(); loadReports(); loadCancelRequests();
  }, []);

  const refresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadCampaigns(), loadUsers(), loadRewards(), loadVerifications(), loadReports(), loadCancelRequests()]);
    setIsRefreshing(false);
    toast.success('Data refreshed.');
  };

  // ── Actions ────────────────────────────────────────────────
  const handleCampaignAction = async (id: string, action: string) => {
    if (action === 'view') { navigate(`/campaign/${id}`); return; }
    if (action === 'cancel') {
      setCancelTarget(campaigns.find(x => x.id === id) ?? null);
      return;
    }
    const newStatus = action === 'approve' ? 'active' : 'draft';
    try {
      await dbFetch(
        `campaigns?id=eq.${id}`,
        'PATCH',
        { status: newStatus, updated_at: new Date().toISOString() }
      );
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      toast.success(action === 'approve' ? 'Campaign approved.' : 'Campaign suspended.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMintReward = async (id: string) => {
    try {
      await dbFetch(
        `rewards?id=eq.${id}`,
        'PATCH',
        { status: 'minted', minted_at: new Date().toISOString() }
      );
      setRewards(prev => prev.map(r => r.id === id ? { ...r, status: 'minted' } : r));
      toast.success('Reward minted.');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleUserRole = (u: AdminUser) => {
    setRoleToggleTarget(u);
  };

  const confirmToggleUserRole = async (u: AdminUser) => {
    const newRole = u.role === 'donor' ? 'organizer' : 'donor';
    try {
      await dbFetch(`profiles?id=eq.${u.id}`, 'PATCH', { role: newRole });
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
      toast.success(`${u.name} is now a${newRole === 'organizer' ? 'n' : ''} ${newRole}.`);
    } catch (err: any) {
      toast.error(err.message);
      throw err;
    }
  };

  const handleReportAction = async (
    reportId: string,
    action: 'reviewed' | 'dismissed',
    campaignId?: string,
  ) => {
    try {
      if (action === 'reviewed' && campaignId) {
        setCancelTarget(campaigns.find(x => x.id === campaignId) ?? null);
        setPendingReportId(reportId);
        return;
      }
      await updateReportStatus(reportId, action);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: action } : r));
      if (action === 'dismissed') toast.success('Report dismissed.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update report');
    }
  };

  const handleRegisterAdmin = async () => {
    if (!isConnected || !address) {
      toast.error('Please connect your wallet first');
      await connect();
      return;
    }
    setIsAddingAdmin(true);
    try {
      await addAdmin(address);
      setIsAdmin(true);
      toast.success(`Wallet ${address.slice(0, 6)}...${address.slice(-4)} registered as admin on-chain!`);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed — make sure you are connected as contract owner');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  // ── Auth guard ─────────────────────────────────────────────
  if (authLoading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!isAuthenticated || user?.role !== 'admin') return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-destructive/10 p-6 rounded-full mb-6">
        <ShieldAlert className="w-16 h-16 text-destructive" />
      </div>
      <h2 className="text-3xl font-bold mb-4">Access Denied</h2>
      <p className="text-muted-foreground max-w-md mb-8">This page is restricted to administrators only.</p>
      <Button variant="outline" onClick={() => navigate(ROUTE_PATHS.HOME)}>Back to Home</Button>
    </div>
  );

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700',
    completed: 'bg-blue-100 text-blue-700',
    draft: 'bg-slate-100 text-slate-600',
    cancelled: 'bg-red-100 text-red-600',
    expired: 'bg-orange-100 text-orange-600',
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = !userSearch ||
      u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const roleCounts = {
    all: users.length,
    donor: users.filter(u => u.role === 'donor').length,
    organizer: users.filter(u => u.role === 'organizer').length,
    admin: users.filter(u => u.role === 'admin').length,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-8 h-8 text-primary" /> Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Platform monitoring · Campaign review · Reward management</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {address?.slice(0, 6)}...{address?.slice(-4)}
                {!isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-xs ml-1 border-emerald-300"
                    onClick={handleRegisterAdmin}
                    disabled={isAddingAdmin}
                  >
                    {isAddingAdmin
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <ShieldCheck className="w-3 h-3 mr-1" />}
                    {isAddingAdmin ? 'Registering...' : 'Register as Admin'}
                  </Button>
                )}
                {isAdmin && (
                  <span className="ml-1 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                    ✓ On-chain Admin
                  </span>
                )}
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={connect} className="gap-2 text-xs">
                <Wallet className="w-3.5 h-3.5" /> Connect Wallet
              </Button>
            )}
            <Button variant="outline" onClick={refresh} disabled={isRefreshing} className="gap-2">
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard title="Total campaigns" value={stats.totalCampaigns} icon={LayoutDashboard} loading={loadingCampaigns} />
          <StatCard title="Active" value={stats.activeCampaigns} icon={TrendingUp} loading={loadingCampaigns} color="text-emerald-600" />
          <StatCard title="Users" value={stats.totalUsers} icon={Users} loading={loadingUsers} />
          <StatCard title="Pending verifications" value={stats.pendingVerifications} icon={ShieldCheck} loading={loadingVerifications} color="text-blue-600" />
          <StatCard title="Pending reports" value={stats.pendingReports} icon={Flag} loading={loadingReports} color="text-red-500" />
          <StatCard title="Cancel requests" value={stats.pendingCancelRequests} icon={Ban} loading={loadingCancelRequests} color="text-orange-500" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="campaigns" className="gap-2">
              <LayoutDashboard className="w-4 h-4" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-2 relative">
              <Flag className="w-4 h-4" /> Reports
              {stats.pendingReports > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {stats.pendingReports}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="verifications" className="gap-2 relative">
              <ShieldCheck className="w-4 h-4" /> Verifications
              {stats.pendingVerifications > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {stats.pendingVerifications}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="cancelrequests" className="gap-2 relative">
              <Ban className="w-4 h-4" /> Cancel Requests
              {stats.pendingCancelRequests > 0 && (
                <span className="ml-1 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {stats.pendingCancelRequests}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Campaigns ── */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <CardTitle>All Campaigns</CardTitle>
                <CardDescription>
                  Review, approve, or cancel campaigns. ✅ = verified organizer, ⚠️ = unverified.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loadingCampaigns
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : campaigns.length === 0
                    ? <p className="text-center text-muted-foreground py-16">No campaigns found.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Campaign</th>
                            <th className="px-4 py-3 text-left font-medium">Organizer</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Progress</th>
                            <th className="px-4 py-3 text-center font-medium">Donors</th>
                            <th className="px-4 py-3 text-left font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {campaigns.map((c) => {
                            const pct = Math.min(100, Math.round((c.current_amount / c.goal_amount) * 100));
                            return (
                              <tr key={c.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-sm">{c.title}</p>
                                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{c.organizer_name}</span>
                                    {c.organizer_verified
                                      ? <CheckCircle className="w-3.5 h-3.5 text-primary shrink-0" title="Verified organizer" />
                                      : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="Unverified organizer" />}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{c.organizer_email}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor[c.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="space-y-1 min-w-[120px]">
                                    <Progress value={pct} className="h-1.5" />
                                    <p className="text-xs text-muted-foreground">
                                      {pct}% · {c.current_amount.toLocaleString()} ETH / {c.goal_amount.toLocaleString()} ETH
                                    </p>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-center">{c.donor_count}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1">
                                    <Button size="sm" variant="ghost" title="View campaign"
                                      onClick={() => handleCampaignAction(c.id, 'view')}>
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    {c.status === 'draft' && (
                                      <Button size="sm" variant="ghost" className="text-emerald-600" title="Approve"
                                        onClick={() => handleCampaignAction(c.id, 'approve')}>
                                        <CheckCircle2 className="w-3 h-3" />
                                      </Button>
                                    )}
                                    {c.status === 'active' && (
                                      <Button size="sm" variant="ghost" className="text-destructive" title="Cancel campaign"
                                        onClick={() => handleCampaignAction(c.id, 'cancel')}>
                                        <Ban className="w-3 h-3" />
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Users ── */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription className="mt-1">
                      Manage roles and view activity for all registered users.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-64 shrink-0">
                    <input
                      type="text"
                      placeholder="Search name or email…"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
                    />
                    <svg
                      className="absolute left-2.5 top-2 w-3.5 h-3.5 text-muted-foreground pointer-events-none"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <circle cx="11" cy="11" r="8" strokeWidth="2" />
                      <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {(['all', 'donor', 'organizer', 'admin'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => setUserRoleFilter(role)}
                      className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors capitalize ${userRoleFilter === role
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground border-border hover:bg-muted/50'
                        }`}
                    >
                      {role === 'all' ? 'All' : role} <span className="opacity-60">({roleCounts[role]})</span>
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loadingUsers
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : filteredUsers.length === 0
                    ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">
                          {userSearch || userRoleFilter !== 'all' ? 'No users match your filters.' : 'No users found.'}
                        </p>
                        {(userSearch || userRoleFilter !== 'all') && (
                          <button
                            className="text-xs text-primary mt-2 hover:underline"
                            onClick={() => { setUserSearch(''); setUserRoleFilter('all'); }}
                          >
                            Clear filters
                          </button>
                        )}
                      </div>
                    )
                    : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">User</th>
                            <th className="px-4 py-3 text-left font-medium">Role</th>
                            <th className="px-4 py-3 text-left font-medium">Verification</th>
                            <th className="px-4 py-3 text-center font-medium">Donations</th>
                            <th className="px-4 py-3 text-left font-medium">Joined</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.map((u) => {
                            const initials = u.name
                              ? u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                              : '?';
                            return (
                              <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium leading-none truncate">{u.name}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge
                                    variant={u.role === 'admin' ? 'default' : u.role === 'organizer' ? 'secondary' : 'outline'}
                                    className="text-xs capitalize"
                                  >
                                    {u.role}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3">
                                  {u.is_verified ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      <CheckCircle className="w-3 h-3" /> Verified
                                    </span>
                                  ) : u.verification_status === 'pending' ? (
                                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                      <Clock className="w-3 h-3" /> Pending
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {u.donation_count > 0 ? (
                                    <span className="inline-flex items-center justify-center text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full min-w-[24px]">
                                      {u.donation_count}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">0</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                  {new Date(u.joined).toLocaleDateString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Rewards ── */}
          <TabsContent value="rewards">
            <Card>
              <CardHeader>
                <CardTitle>Reward Distribution</CardTitle>
                <CardDescription>On-chain mint status of donor rewards.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loadingRewards
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : rewards.length === 0
                    ? <p className="text-center text-muted-foreground py-16">No rewards yet.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Donor</th>
                            <th className="px-4 py-3 text-left font-medium">Campaign</th>
                            <th className="px-4 py-3 text-left font-medium">Type</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                            <th className="px-4 py-3 text-left font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rewards.map((r) => (
                            <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium">{r.donor_name}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">{r.campaign_title}</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline" className="text-xs">{r.type}</Badge>
                                {r.token_amount && <span className="ml-1 text-xs text-primary">+{r.token_amount}</span>}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-100 text-amber-700'
                                  : r.status === 'minted' ? 'bg-emerald-100 text-emerald-700'
                                    : r.status === 'claimed' ? 'bg-blue-100 text-blue-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {r.status === 'pending'
                                  ? <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => handleMintReward(r.id)}>
                                    <Gift className="w-3 h-3" /> Trigger mint
                                  </Button>
                                  : <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {r.status}
                                  </span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Reports ── */}
          <TabsContent value="reports">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flag className="w-5 h-5 text-destructive" /> Campaign Reports
                </CardTitle>
                <CardDescription>
                  User-submitted reports. Dismiss if invalid, or proceed to cancel the campaign.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingReports
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : reports.length === 0
                    ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Flag className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">No reports yet.</p>
                        <p className="text-sm mt-1">Reports submitted by users will appear here.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/30 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Campaign</th>
                              <th className="px-4 py-3 text-left font-medium">Reporter</th>
                              <th className="px-4 py-3 text-left font-medium">Reason</th>
                              <th className="px-4 py-3 text-left font-medium">Details</th>
                              <th className="px-4 py-3 text-left font-medium">Date</th>
                              <th className="px-4 py-3 text-left font-medium">Status</th>
                              <th className="px-4 py-3 text-left font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reports.map((r) => (
                              <tr key={r.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-sm">{(r.campaigns as any)?.title ?? r.campaign_id}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {(r.profiles as any)?.name ?? 'Anonymous'}
                                </td>
                                <td className="px-4 py-3">
                                  <Badge variant="outline" className="text-xs capitalize">{r.reason_type}</Badge>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[160px]">
                                  <span className="line-clamp-2">{r.reason_detail ?? '—'}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {new Date(r.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.status === 'pending' ? 'bg-amber-100 text-amber-700'
                                    : r.status === 'dismissed' ? 'bg-slate-100 text-slate-500'
                                      : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {r.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {r.status === 'pending' && (
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost"
                                        className="text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => handleReportAction(r.id, 'dismissed')}>
                                        Dismiss
                                      </Button>
                                      <Button size="sm" variant="destructive" className="text-xs"
                                        onClick={() => handleReportAction(r.id, 'reviewed', r.campaign_id)}>
                                        Cancel Campaign
                                      </Button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Verifications ── */}
          <TabsContent value="verifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" /> Identity Verification Requests
                </CardTitle>
                <CardDescription>
                  Review submitted documents and approve or reject organizer verification requests.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingVerifications
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : verifications.length === 0
                    ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">No verification requests yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/30 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Applicant</th>
                              <th className="px-4 py-3 text-left font-medium">ID Type</th>
                              <th className="px-4 py-3 text-left font-medium">Submitted</th>
                              <th className="px-4 py-3 text-left font-medium">Status</th>
                              <th className="px-4 py-3 text-left font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {verifications.map((v) => {
                              const vstyle = {
                                pending: 'bg-amber-100 text-amber-700',
                                approved: 'bg-emerald-100 text-emerald-700',
                                rejected: 'bg-red-100 text-red-700',
                              }[v.status] ?? '';
                              const VIcon = { pending: Clock, approved: CheckCircle2, rejected: XCircle }[v.status] ?? Clock;
                              return (
                                <tr key={v.id} className="border-b hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-3">
                                    <p className="font-medium">{v.full_name}</p>
                                    <p className="text-xs text-muted-foreground">{(v.profiles as any)?.email ?? v.user_id}</p>
                                  </td>
                                  <td className="px-4 py-3 text-xs">{v.id_type}</td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {new Date(v.created_at).toLocaleDateString()}
                                  </td>
                                  <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${vstyle}`}>
                                      <VIcon className="w-3 h-3" />
                                      {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Button size="sm" variant="outline" className="text-xs gap-1"
                                      onClick={() => setSelectedVerification(v)}>
                                      <Eye className="w-3 h-3" />
                                      {v.status === 'pending' ? 'Review' : 'View'}
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Cancel Requests ── */}
          <TabsContent value="cancelrequests">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ban className="w-5 h-5 text-orange-500" /> Campaign Cancel Requests
                </CardTitle>
                <CardDescription>
                  Organizers submit these when they want to close their campaign.
                  Approving will cancel the campaign on-chain (ETH refundable by donors) — FDY tokens earned are kept.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingCancelRequests
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : cancelRequests.length === 0
                    ? (
                      <div className="text-center py-16 text-muted-foreground">
                        <Ban className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p className="font-medium">No cancel requests yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b bg-muted/30 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Campaign</th>
                              <th className="px-4 py-3 text-left font-medium">Organizer</th>
                              <th className="px-4 py-3 text-left font-medium">Reason</th>
                              <th className="px-4 py-3 text-left font-medium">Date</th>
                              <th className="px-4 py-3 text-left font-medium">Status</th>
                              <th className="px-4 py-3 text-left font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cancelRequests.map((cr) => (
                              <tr key={cr.id} className="border-b hover:bg-muted/30 transition-colors">
                                <td className="px-4 py-3">
                                  <p className="font-medium text-sm">{(cr.campaigns as any)?.title ?? cr.campaign_id}</p>
                                  {(cr.campaigns as any)?.on_chain_id && (
                                    <p className="text-xs text-muted-foreground">Chain ID: #{(cr.campaigns as any).on_chain_id}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  <p className="font-medium text-foreground">{(cr.profiles as any)?.name ?? '—'}</p>
                                  <p>{(cr.profiles as any)?.email ?? ''}</p>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px]">
                                  <span className="line-clamp-3">{cr.reason}</span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                  {new Date(cr.created_at).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cr.status === 'pending' ? 'bg-amber-100 text-amber-700'
                                    : cr.status === 'approved' ? 'bg-red-100 text-red-700'
                                      : 'bg-slate-100 text-slate-500'
                                    }`}>
                                    {cr.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {cr.status === 'pending' && (
                                    <Button size="sm" variant="ghost"
                                      className="text-xs text-muted-foreground hover:text-foreground"
                                      onClick={() => setSelectedCancelRequest(cr)}>
                                      <Eye className="w-3 h-3 mr-1" /> Review
                                    </Button>
                                  )}
                                  {cr.status !== 'pending' && (
                                    <Button size="sm" variant="ghost" className="text-xs text-muted-foreground"
                                      onClick={() => setSelectedCancelRequest(cr)}>
                                      <Eye className="w-3 h-3 mr-1" /> View
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Dialogs */}
      <CancelCampaignDialog
        campaign={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={async (id) => {
          setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' } : c));
          if (pendingReportId) {
            await updateReportStatus(pendingReportId, 'reviewed');
            setReports(prev => prev.map(r => r.id === pendingReportId ? { ...r, status: 'reviewed' } : r));
            setPendingReportId(null);
          }
        }}
      />
      <VerificationDialog
        request={selectedVerification}
        onClose={() => setSelectedVerification(null)}
        onProcessed={(id, action, note) =>
          setVerifications(prev => prev.map(v => v.id === id ? { ...v, status: action, admin_note: note } : v))
        }
      />
      <CancelRequestReviewDialog
        request={selectedCancelRequest}
        onClose={() => setSelectedCancelRequest(null)}
        onProcessed={async (id, action) => {
          console.log('🔄 Refreshing data after processing request:', id, action);

          try {
            // Force refresh cancel requests from database
            const freshCancelRequests = await fetchCancelRequests();
            console.log('Fresh cancel requests:', freshCancelRequests);
            setCancelRequests(freshCancelRequests);

            // Force refresh campaigns
            const freshCampaigns = await dbFetch(
              'campaigns?select=id,title,status,current_amount,goal_amount,donor_count,created_at,on_chain_id,profiles(name,email,is_verified)&order=created_at.desc'
            );
            setCampaigns(freshCampaigns.map((c: any) => ({
              id: c.id,
              title: c.title,
              status: c.status,
              current_amount: Number(c.current_amount),
              goal_amount: Number(c.goal_amount),
              donor_count: c.donor_count,
              organizer_name: c.profiles?.name ?? '—',
              organizer_email: c.profiles?.email ?? '',
              organizer_verified: c.profiles?.is_verified ?? false,
              created_at: c.created_at,
              on_chain_id: c.on_chain_id ?? null,
            })));

            // Update pending counts in stats
            // The stats will automatically update because they depend on the state

            toast.success(action === 'approved'
              ? 'Cancel request approved - campaign cancelled'
              : 'Cancel request rejected');
          } catch (err) {
            console.error('Failed to refresh data:', err);
            toast.error('Failed to refresh data, please refresh manually');
          }
        }}
      />
      <RoleToggleConfirmDialog
        user={roleToggleTarget}
        onClose={() => setRoleToggleTarget(null)}
        onConfirmed={confirmToggleUserRole}
      />
    </div>
  );
}