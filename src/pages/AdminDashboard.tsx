import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Users, TrendingUp, ShieldAlert, CheckCircle2,
  Clock, Loader2, AlertTriangle, RefreshCw, Gift, Ban, Eye,
  ShieldCheck, XCircle, FileText, Flag, CheckCircle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '@/lib/index';
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
  supabase,
  fetchVerificationRequests,
  processVerificationRequest,
  cancelCampaignWithReason,
  updateReportStatus,
  fetchReports,
  DbVerificationRequest,
  DbReport,
} from '@/lib/supabase';

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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Admin Note (optional — shown to user)
            </label>
            <Textarea
              placeholder="e.g. Document was unclear, please resubmit with a clearer photo."
              rows={2} value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
            />
          </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [verifications, setVerifications] = useState<DbVerificationRequest[]>([]);
  const [reports, setReports] = useState<DbReport[]>([]);

  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRewards, setLoadingRewards] = useState(true);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [selectedVerification, setSelectedVerification] = useState<DbVerificationRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminCampaign | null>(null);

  const stats = {
    totalCampaigns: campaigns.length,
    activeCampaigns: campaigns.filter(c => c.status === 'active').length,
    totalUsers: users.length,
    pendingRewards: rewards.filter(r => r.status === 'pending').length,
    pendingVerifications: verifications.filter(v => v.status === 'pending').length,
    pendingReports: reports.filter(r => r.status === 'pending').length,
  };

  // ── Loaders ────────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, title, status, current_amount, goal_amount, donor_count, created_at, profiles(name, email, is_verified)')
        .order('created_at', { ascending: false });
      if (error) throw error;
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
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, role, created_at, is_verified, verification_status')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const { data: donationData } = await supabase.from('donations').select('donor_id');
      const counts: Record<string, number> = {};
      (donationData ?? []).forEach((d: any) => {
        if (d.donor_id) counts[d.donor_id] = (counts[d.donor_id] ?? 0) + 1;
      });
      setUsers((data ?? []).map((u: any) => ({
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
      const { data, error } = await supabase
        .from('rewards')
        .select('id, status, type, token_amount, campaigns(title), profiles:donor_id(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
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

  useEffect(() => {
    loadCampaigns(); loadUsers(); loadRewards(); loadVerifications(); loadReports();
  }, []);

  const refresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadCampaigns(), loadUsers(), loadRewards(), loadVerifications(), loadReports()]);
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
    const { error } = await supabase
      .from('campaigns')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
    toast.success(action === 'approve' ? 'Campaign approved.' : 'Campaign suspended.');
  };

  const handleMintReward = async (id: string) => {
    const { error } = await supabase
      .from('rewards')
      .update({ status: 'minted', minted_at: new Date().toISOString() })
      .eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRewards(prev => prev.map(r => r.id === id ? { ...r, status: 'minted' } : r));
    toast.success('Reward minted.');
  };

  const handleToggleUserRole = async (u: AdminUser) => {
    const newRole = u.role === 'donor' ? 'organizer' : 'donor';
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id);
    if (error) { toast.error(error.message); return; }
    setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x));
    toast.success(`Role updated to ${newRole}.`);
  };

  const handleReportAction = async (
    reportId: string,
    action: 'reviewed' | 'dismissed',
    campaignId?: string,
  ) => {
    try {
      await updateReportStatus(reportId, action);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: action } : r));
      if (action === 'reviewed' && campaignId) {
        // Open cancel dialog for the reported campaign
        setCancelTarget(campaigns.find(x => x.id === campaignId) ?? null);
      }
      if (action === 'dismissed') toast.success('Report dismissed.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to update report');
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
          <Button variant="outline" onClick={refresh} disabled={isRefreshing} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <StatCard title="Total campaigns"        value={stats.totalCampaigns}       icon={LayoutDashboard} loading={loadingCampaigns} />
          <StatCard title="Active"                 value={stats.activeCampaigns}      icon={TrendingUp}      loading={loadingCampaigns} color="text-emerald-600" />
          <StatCard title="Users"                  value={stats.totalUsers}           icon={Users}           loading={loadingUsers} />
          <StatCard title="Pending rewards"        value={stats.pendingRewards}       icon={Gift}            loading={loadingRewards} color="text-amber-600" />
          <StatCard title="Pending verifications"  value={stats.pendingVerifications} icon={ShieldCheck}     loading={loadingVerifications} color="text-blue-600" />
          <StatCard title="Pending reports"        value={stats.pendingReports}       icon={Flag}            loading={loadingReports} color="text-red-500" />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="campaigns">
          <TabsList className="mb-6 flex-wrap h-auto gap-1">
            <TabsTrigger value="campaigns"     className="gap-2">
              <LayoutDashboard className="w-4 h-4" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="users"         className="gap-2">
              <Users className="w-4 h-4" /> Users
            </TabsTrigger>
            <TabsTrigger value="rewards"       className="gap-2">
              <Gift className="w-4 h-4" /> Rewards
            </TabsTrigger>
            <TabsTrigger value="reports"       className="gap-2 relative">
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
                                      {pct}% · RM{c.current_amount.toLocaleString()} / RM{c.goal_amount.toLocaleString()}
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
                <CardTitle>User Management</CardTitle>
                <CardDescription>All registered users, roles, verification status, and activity.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                {loadingUsers
                  ? <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
                  : users.length === 0
                    ? <p className="text-center text-muted-foreground py-16">No users found.</p>
                    : (
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/30 text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">User</th>
                            <th className="px-4 py-3 text-left font-medium">Role</th>
                            <th className="px-4 py-3 text-left font-medium">Verified</th>
                            <th className="px-4 py-3 text-center font-medium">Donations</th>
                            <th className="px-4 py-3 text-left font-medium">Joined</th>
                            <th className="px-4 py-3 text-left font-medium">Change Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-medium">{u.name}</p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={u.role === 'admin' ? 'default' : u.role === 'organizer' ? 'secondary' : 'outline'}
                                  className="text-xs"
                                >
                                  {u.role}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {u.is_verified
                                  ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      <CheckCircle className="w-3 h-3" /> Verified
                                    </span>
                                  : u.verification_status === 'pending'
                                    ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                        <Clock className="w-3 h-3" /> Pending
                                      </span>
                                    : <span className="text-xs text-muted-foreground">—</span>}
                              </td>
                              <td className="px-4 py-3 text-center">{u.donation_count}</td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {new Date(u.joined).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3">
                                {u.role !== 'admin' && (
                                  <Button size="sm" variant="ghost"
                                    className="text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => handleToggleUserRole(u)}>
                                    → {u.role === 'donor' ? 'organizer' : 'donor'}
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
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
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                  r.status === 'pending' ? 'bg-amber-100 text-amber-700'
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
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                    r.status === 'pending' ? 'bg-amber-100 text-amber-700'
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
        </Tabs>
      </motion.div>

      {/* Dialogs */}
      <CancelCampaignDialog
        campaign={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onCancelled={(id) => setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'cancelled' } : c))}
      />
      <VerificationDialog
        request={selectedVerification}
        onClose={() => setSelectedVerification(null)}
        onProcessed={(id, action, note) =>
          setVerifications(prev => prev.map(v => v.id === id ? { ...v, status: action, admin_note: note } : v))
        }
      />
    </div>
  );
}
