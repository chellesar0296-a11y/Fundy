import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign } from '@/hooks/useCampaigns';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Loader2, Gift, MessageCircle, TrendingUp,
  Send, ImagePlus, Trash2, Edit, Save, Info, Clock, XCircle, CheckCircle2,
  Wallet, AlertTriangle,
} from 'lucide-react';
import { useWeb3, CROWDFUNDING_ABI, CONTRACT_ADDRESSES } from '@/context/Web3Context';
import { ethers } from 'ethers';
import {
  createCampaignUpdate,
  getCampaignUpdates,
  updateCampaign,
  uploadMedia,
  submitCancelRequest,
  fetchMyCancelRequest,
  DbCancelRequest,
} from '@/lib/supabase';

// ── Extra Stake Token Reward Card ─────────────────────────────
// ── Extra Stake Token Reward Card — reads live from chain, calculates remaining slots correctly ──

function ExtraFdyRewardCard({ onChainId }: { onChainId: number }) {
  const { provider } = useWeb3();
  const [info, setInfo] = React.useState<{
    hasExtra: boolean;
    quantity: number;
    fdyAmount: string;
    minDonate: string;
    slotsTaken: number;      // ✅ 实际已领奖人数
    slotsRemaining: number;   // ✅ 动态计算
    tokenSymbol: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!provider || !onChainId) return;
    
    let cancelled = false;
    setLoading(true);
    
    (async () => {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, provider);
        
        const [campaign, extra] = await Promise.all([
          contract.getCampaign(onChainId),
          contract.getExtraRewardInfo(onChainId),
        ]);
        
        const extraQuantity = Number(extra.quantity);
        
        if (!extra.hasExtra || extraQuantity === 0) {
          if (!cancelled) {
            setInfo({
              hasExtra: false,
              quantity: 0,
              fdyAmount: '0',
              minDonate: '0',
              slotsTaken: 0,
              slotsRemaining: 0,
              tokenSymbol: campaign.tokenSymbol || 'FDY',
            });
            setLoading(false);
          }
          return;
        }
        
        const donorsList = await contract.getDonors(onChainId);
        
        const minDonateWei = extra.minDonate;
        
        const qualifiedDonors = await Promise.all(
          donorsList.map(async (donor: string) => {

            const donationWei = await contract.getEthDonation(onChainId, donor);

            const alreadyAwarded = await contract.extraAwarded(onChainId, donor);
            

            return donationWei >= minDonateWei && !alreadyAwarded;
          })
        );
        
        const slotsTaken = qualifiedDonors.filter(Boolean).length;
        const slotsRemaining = Math.max(0, extraQuantity - slotsTaken);
        
        if (!cancelled) {
          setInfo({
            hasExtra: extra.hasExtra,
            quantity: extraQuantity,
            fdyAmount: ethers.formatEther(extra.fdyAmount),
            minDonate: Number(ethers.formatEther(extra.minDonate)).toFixed(4),
            slotsTaken: slotsTaken,
            slotsRemaining: slotsRemaining,
            tokenSymbol: campaign.tokenSymbol || 'FDY',
          });
        }
      } catch (err) {
        console.error('[ExtraFdyRewardCard]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    
    return () => { cancelled = true; };
  }, [provider, onChainId]);

  if (loading) return (
    <div className="p-5 border rounded-xl flex items-center gap-3 text-muted-foreground text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Loading reward info...
    </div>
  );

  if (!info || !info.hasExtra) return (
    <div className="p-5 border border-dashed rounded-xl text-center text-muted-foreground text-sm">
      <Gift className="w-8 h-8 mx-auto mb-2 opacity-20" />
      No extra stake token reward for this campaign.
    </div>
  );

  const isSoldOut = info.slotsRemaining === 0;

  return (
    <div className={`p-5 border rounded-xl space-y-2 ${isSoldOut ? 'bg-muted/30 border-muted' : 'bg-amber-50 border-amber-200'}`}>
      <p className={`font-semibold flex items-center gap-2 ${isSoldOut ? 'text-muted-foreground' : 'text-amber-900'}`}>
        🎁 Extra Stake Token Reward
        {isSoldOut
          ? <span className="text-xs font-normal bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Sold Out</span>
          : <span className="text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Active</span>
        }
      </p>
      <p className={`text-sm ${isSoldOut ? 'text-muted-foreground line-through' : 'text-amber-800'}`}>
        The first <strong>{info.quantity}</strong> donors who contribute <strong>≥ {info.minDonate} ETH</strong> each
        receive an extra <strong>{Number(info.fdyAmount).toLocaleString()} {info.tokenSymbol}</strong> stake tokens.
        Each donor can only receive this reward once.
      </p>
      <p className={`text-xs font-medium ${isSoldOut ? 'text-muted-foreground' : 'text-amber-700'}`}>
        {isSoldOut
          ? 'All extra reward slots have been claimed.'
          : `${info.slotsRemaining} of ${info.quantity} slots remaining (${info.slotsTaken} claimed)`}
      </p>
      
      {!isSoldOut && info.slotsTaken > 0 && (
        <p className="text-[10px] text-amber-600">
          ✅ {info.slotsTaken} donor{info.slotsTaken !== 1 ? 's' : ''} qualified
        </p>
      )}
      
      <p className="text-[10px] text-muted-foreground mt-2">
        ⚠️ Extra rewards are minted when the organizer withdraws funds after campaign completion.
      </p>
    </div>
  );
}
// ── Stakeholders Panel ────────────────────────────────────────
function StakeholdersPanel({ onChainId }: { onChainId: number }) {
  const { provider } = useWeb3();
  const [holders, setHolders] = React.useState<{
    address: string;
    ethDonated: string;
    stakeBalance: string;
    stakePct: string;
  }[]>([]);
  const [tokenSymbol, setTokenSymbol] = React.useState('FDY');
  const [totalStake, setTotalStake] = React.useState('0');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!provider || !onChainId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, provider);
        const campaign = await contract.getCampaign(onChainId);
        const sym = campaign.tokenSymbol || 'FDY';
        if (!cancelled) setTokenSymbol(sym);

        const donorList: string[] = await contract.getDonors(onChainId);
        if (donorList.length === 0) {
          if (!cancelled) { setHolders([]); setLoading(false); }
          return;
        }

        const tokenContract = new ethers.Contract(
          campaign.stakeToken,
          [
            'function balanceOf(address) view returns (uint256)',
            'function totalSupply() view returns (uint256)',
          ],
          provider,
        );

        const [totalSupply, ...balances] = await Promise.all([
          tokenContract.totalSupply(),
          ...donorList.map((d: string) => tokenContract.balanceOf(d)),
        ]);

        const totalNum = Number(ethers.formatEther(totalSupply));
        if (!cancelled) setTotalStake(totalNum.toLocaleString(undefined, { maximumFractionDigits: 2 }));

        const rows = await Promise.all(donorList.map(async (d: string, i: number) => {
          const bal = Number(ethers.formatEther(balances[i]));
          const ethAmt = Number(ethers.formatEther(await contract.getEthDonation(onChainId, d)));
          const pct = totalNum > 0 ? ((bal / totalNum) * 100).toFixed(2) : '0.00';
          return {
            address:      d,
            ethDonated:   ethAmt.toFixed(4),
            stakeBalance: bal.toLocaleString(undefined, { maximumFractionDigits: 2 }),
            stakePct:     pct,
          };
        }));

        rows.sort((a, b) => parseFloat(b.stakeBalance.replace(/,/g, '')) - parseFloat(a.stakeBalance.replace(/,/g, '')));
        if (!cancelled) setHolders(rows);
      } catch (e) {
        console.error('[StakeholdersPanel]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [provider, onChainId]);

  if (loading) return (
    <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
      <Loader2 className="w-5 h-5 animate-spin" /> Loading stakeholder data...
    </div>
  );

  if (holders.length === 0) return (
    <div className="text-center py-10 text-muted-foreground text-sm space-y-2">
      <p>No stakeholders yet.</p>
      <p className="text-xs">Stake tokens are minted when you withdraw funds after the campaign succeeds.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Total supply: <span className="font-semibold text-foreground">{totalStake} {tokenSymbol}</span> · Showing all {holders.length} stakeholders
      </p>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-xs text-muted-foreground">
              <th className="text-left px-4 py-2.5 font-semibold">#</th>
              <th className="text-left px-4 py-2.5 font-semibold">Wallet</th>
              <th className="text-right px-4 py-2.5 font-semibold">ETH Donated</th>
              <th className="text-right px-4 py-2.5 font-semibold">{tokenSymbol} Balance</th>
              <th className="text-right px-4 py-2.5 font-semibold">Stake %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {holders.map((h, i) => (
              <tr key={h.address} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground text-xs">{i + 1}</td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs">{h.address.slice(0, 8)}...{h.address.slice(-6)}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">⟠ {h.ethDonated}</td>
                <td className="px-4 py-3 text-right font-semibold text-xs">{h.stakeBalance}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, parseFloat(h.stakePct))}%` }} />
                    </div>
                    <span className="text-xs font-semibold w-12 text-right">{h.stakePct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Cancel Request Dialog ─────────────────────────────────────
function CancelRequestDialog({
  open, onClose, onSubmitted, existingRequest,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (req: DbCancelRequest) => void;
  existingRequest: DbCancelRequest | null;
}) {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (existingRequest) {
    const statusIcon = {
      pending:  <Clock className="w-5 h-5 text-amber-500" />,
      approved: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
      rejected: <XCircle className="w-5 h-5 text-destructive" />,
    }[existingRequest.status];

    const statusColor = {
      pending:  'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
    }[existingRequest.status];

    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">{statusIcon} Cancel Request Status</DialogTitle>
            <DialogDescription>Your cancel request has been submitted and is being reviewed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 text-sm">
            <div className="p-3 bg-muted/40 rounded-lg">
              <p className="text-xs text-muted-foreground mb-1">Your reason</p>
              <p>{existingRequest.reason}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status:</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
                {existingRequest.status.charAt(0).toUpperCase() + existingRequest.status.slice(1)}
              </span>
            </div>
            {existingRequest.admin_note && (
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Admin note</p>
                <p>{existingRequest.admin_note}</p>
              </div>
            )}
            {existingRequest.status === 'pending' && (
              <p className="text-xs text-muted-foreground">Your campaign remains active while this request is under review.</p>
            )}
            <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" /> Request Campaign Cancellation
          </DialogTitle>
          <DialogDescription>
            Your request will be reviewed by our admin team. Your campaign stays active until approved.
            Once cancelled, <strong>ETH donations will be refundable on-chain</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Reason for cancellation <span className="text-destructive">*</span></Label>
            <Textarea
              placeholder="Please explain why you want to cancel this campaign..."
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>Admin will review your request and may approve or reject it.</span>
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>Back</Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={isSubmitting || !reason.trim()}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  onSubmitted({ reason } as any);
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting
                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                : <Send className="w-4 h-4 mr-2" />}
              Submit Request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function CampaignManage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaign, isLoading } = useCampaign(id ?? '');
  const { withdrawFunds, getCampaignOnChain, isConnected, connect } = useWeb3();
  const [activeTab, setActiveTab] = useState('overview');

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [onChainData, setOnChainData] = useState<any>(null);
  const [loadingOnChain, setLoadingOnChain] = useState(false);

  const [updateTitle, setUpdateTitle] = useState('');
  const [updateContent, setUpdateContent] = useState('');
  const [isPostingUpdate, setIsPostingUpdate] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);

  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editShortDesc, setEditShortDesc] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');

  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<DbCancelRequest | null>(null);
  const [loadingCancelRequest, setLoadingCancelRequest] = useState(false);

  React.useEffect(() => {
    if (id) getCampaignUpdates(id).then(setUpdates).catch(console.error);
  }, [id]);

  React.useEffect(() => {
    if (campaign) {
      setEditTitle(campaign.title);
      setEditShortDesc(campaign.shortDescription);
      setEditDesc(campaign.description);
      setEditEndDate(campaign.endDate ? campaign.endDate.split('T')[0] : '');
      setEditImageUrl(campaign.image ?? '');
    }
  }, [campaign?.id]);

  React.useEffect(() => {
    if (id) fetchMyCancelRequest(id).then(setCancelRequest).catch(() => setCancelRequest(null));
  }, [id]);

  React.useEffect(() => {
    if (!campaign?.onChainId) return;
    setLoadingOnChain(true);
    getCampaignOnChain(campaign.onChainId)
      .then(setOnChainData)
      .catch(() => setOnChainData(null))
      .finally(() => setLoadingOnChain(false));
  }, [campaign?.onChainId]);

  const handleWithdraw = async () => {
    if (!campaign?.onChainId) return;
    if (!isConnected) { toast.error('Please connect your wallet first.'); await connect(); return; }
    setIsWithdrawing(true);
    try {
      await withdrawFunds(campaign.onChainId);
      toast.success('Funds withdrawn successfully!');
      await updateCampaign(id!, { status: 'completed' });
      const updated = await getCampaignOnChain(campaign.onChainId);
      setOnChainData(updated);
      toast.success('Campaign marked as completed!');
    } catch (err: any) {
      toast.error(err?.reason ?? err?.message ?? 'Withdrawal failed');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const isOrganizer = campaign?.organizer.id === user?.id;

  if (!isOrganizer && !isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground mb-6">You don't have permission to manage this campaign.</p>
          <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (isLoading || !campaign) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handlePostUpdate = async () => {
    if (!updateTitle.trim() || !updateContent.trim()) { toast.error('Please fill in both title and content'); return; }
    setIsPostingUpdate(true);
    try {
      let imageUrl: string | null = null;
      if (mediaFile) {
        setIsUploadingMedia(true);
        try { imageUrl = await uploadMedia(mediaFile, `updates/${id}`); }
        catch { toast.error('Failed to upload image. Post will be saved without it.'); }
        finally { setIsUploadingMedia(false); }
      }
      await createCampaignUpdate({
        campaign_id: id!, title: updateTitle, content: updateContent,
        author_id: user!.id, author_name: user!.name, image_url: imageUrl,
      });
      toast.success('Update posted successfully!');
      setUpdateTitle(''); setUpdateContent(''); setMediaFile(null); setMediaPreview(null);
      setUpdates(await getCampaignUpdates(id!));
    } catch { toast.error('Failed to post update'); }
    finally { setIsPostingUpdate(false); }
  };

  const handleSaveCampaign = async () => {
    if (!editTitle.trim()) { toast.error('Title cannot be empty'); return; }
    setIsSaving(true);
    try {
      await updateCampaign(id!, {
        title: editTitle.trim(), short_description: editShortDesc.trim(),
        description: editDesc.trim(),
        end_date: editEndDate ? new Date(editEndDate).toISOString() : undefined,
        image_url: editImageUrl.trim() || null,
      });
      toast.success('Campaign updated successfully!');
      setIsEditMode(false);
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to save changes');
    } finally { setIsSaving(false); }
  };

  const handleOpenCancelDialog = async () => {
    setLoadingCancelRequest(true);
    try {
      const req = await fetchMyCancelRequest(id!);
      setCancelRequest(req);
    } catch { setCancelRequest(null); }
    finally { setLoadingCancelRequest(false); setShowCancelDialog(true); }
  };

  const handleCancelSubmit = async (partial: DbCancelRequest) => {
    try {
      const req = await submitCancelRequest(id!, user!.id, partial.reason);
      setCancelRequest(req);
      setShowCancelDialog(false);
      toast.success('Cancel request submitted. Admin will review it shortly.');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit cancel request');
    }
  };

  const cancelRequestBadge = cancelRequest ? {
    pending:  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Cancel Pending Review</Badge>,
    approved: <Badge className="bg-red-100 text-red-700 border-0 text-xs">Cancel Approved</Badge>,
    rejected: <Badge className="bg-slate-100 text-slate-600 border-0 text-xs">Cancel Rejected</Badge>,
  }[cancelRequest.status] : null;

  // ✅ 正确的 goal reached 判断 — 只用 totalRaisedEth，没有 totalRaisedFdy
  const totalRaisedEth  = onChainData ? Number(ethers.formatEther(onChainData.totalRaisedEth)) : 0;
  const goalEth         = onChainData ? Number(ethers.formatEther(onChainData.goalAmount))     : 0;
  const goalReached     = onChainData ? onChainData.totalRaisedEth >= onChainData.goalAmount   : false;
  const alreadyWithdrawn = onChainData?.withdrawn ?? false;
  const cancelled        = onChainData?.cancelled ?? false;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <h1 className="text-2xl font-bold">Manage Campaign</h1>
        <Badge className={campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
          {campaign.status}
        </Badge>
        {cancelRequestBadge}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <img src={campaign.image} alt={campaign.title} className="w-full h-32 object-cover rounded-lg mb-3" />
              <p className="font-semibold text-sm line-clamp-2">{campaign.title}</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{campaign.currentAmount.toLocaleString()} ETH raised</span>
                <span>{campaign.goalAmount.toLocaleString()} ETH goal</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Stats</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Donors</span>
                <span className="font-semibold">{campaign.donorCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updates</span>
                <span className="font-semibold">{updates.length}</span>
              </div>
            </CardContent>
          </Card>

          {/* Withdraw Funds */}
          {campaign.onChainId && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-primary" /> Withdraw Funds
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingOnChain ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading on-chain data...
                  </div>
                ) : onChainData ? (
                  <>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Raised</span>
                        <span className="font-semibold">{totalRaisedEth.toFixed(4)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Goal</span>
                        <span className="font-semibold">{goalEth.toFixed(4)} ETH</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status</span>
                        <span className={`font-semibold ${alreadyWithdrawn ? 'text-muted-foreground' : goalReached ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {alreadyWithdrawn ? 'Withdrawn' : goalReached ? 'Ready to withdraw' : 'Goal not reached'}
                        </span>
                      </div>
                    </div>

                    {!alreadyWithdrawn && !cancelled && goalReached && (
                      <Button size="sm" className="w-full" onClick={handleWithdraw} disabled={isWithdrawing}>
                        {isWithdrawing
                          ? <><Loader2 className="w-3 h-3 animate-spin mr-2" /> Withdrawing...</>
                          : <><Wallet className="w-3 h-3 mr-2" /> Withdraw Funds</>}
                      </Button>
                    )}

                    {!alreadyWithdrawn && !cancelled && !goalReached && (
                      <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-700">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-500" />
                        Goal not yet reached. Withdrawal available once the goal is met.
                      </div>
                    )}

                    {alreadyWithdrawn && (
                      <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg text-[10px] text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        Funds have been successfully withdrawn.
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Unable to load on-chain data.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cancel */}
          <Card className="border-destructive/20">
            <CardContent className="p-4">
              {cancelRequest?.status === 'pending' ? (
                <Button variant="outline" size="sm" className="w-full text-amber-600 border-amber-300" onClick={handleOpenCancelDialog}>
                  <Clock className="w-3 h-3 mr-2" /> View Cancel Request
                </Button>
              ) : cancelRequest?.status === 'approved' ? (
                <p className="text-xs text-center text-destructive font-medium">This campaign has been cancelled.</p>
              ) : (
                <Button variant="destructive" size="sm" className="w-full" onClick={handleOpenCancelDialog}
                  disabled={campaign.status !== 'active' || loadingCancelRequest}>
                  {loadingCancelRequest ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Trash2 className="w-3 h-3 mr-2" />}
                  Request Cancellation
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground text-center mt-2">Cancellation requires admin approval</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview" className="gap-2"><TrendingUp className="w-4 h-4" /> Overview</TabsTrigger>
              <TabsTrigger value="updates" className="gap-2"><MessageCircle className="w-4 h-4" /> Post Update</TabsTrigger>
              <TabsTrigger value="rewards" className="gap-2"><Gift className="w-4 h-4" /> Rewards</TabsTrigger>
              <TabsTrigger value="stakeholders" className="gap-2"><Wallet className="w-4 h-4" /> Stakeholders</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Performance</CardTitle>
                  <CardDescription>Track your campaign's progress and engagement</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{campaign.donorCount}</p>
                      <p className="text-xs text-muted-foreground">Total Donors</p>
                    </div>
                    <div className="text-center p-4 bg-muted/30 rounded-lg">
                      <p className="text-2xl font-bold">{updates.length}</p>
                      <p className="text-xs text-muted-foreground">Updates Posted</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Campaign Details</CardTitle>
                    <CardDescription>Edit your campaign's information</CardDescription>
                  </div>
                  {!isEditMode ? (
                    <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                      <Edit className="w-3 h-3 mr-2" /> Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)}>Cancel</Button>
                      <Button size="sm" onClick={handleSaveCampaign} disabled={isSaving}>
                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Save className="w-3 h-3 mr-2" />}
                        Save
                      </Button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {!isEditMode ? (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Title</p>
                        <p className="font-medium">{campaign.title}</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Short Description</p>
                        <p className="text-sm">{campaign.shortDescription}</p>
                      </div>
                      <Separator />
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">End Date</p>
                        <p className="text-sm">{new Date(campaign.endDate).toLocaleDateString()}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label>Campaign Title</Label>
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Short Description</Label>
                        <Input value={editShortDesc} onChange={(e) => setEditShortDesc(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Full Description</Label>
                        <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={6} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>End Date</Label>
                          <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Campaign Image URL</Label>
                          <Input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://..." />
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        The goal amount cannot be modified after creation to protect your backers.
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Recent Updates</CardTitle></CardHeader>
                <CardContent>
                  {updates.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No updates yet. Post your first update!</p>
                  ) : (
                    <div className="space-y-4">
                      {updates.slice(0, 3).map((update: any) => (
                        <div key={update.id} className="border-b last:border-0 pb-3 last:pb-0">
                          <p className="font-semibold text-sm">{update.title}</p>
                          <p className="text-xs text-muted-foreground">{new Date(update.created_at).toLocaleDateString()}</p>
                          <p className="text-sm mt-1 line-clamp-2">{update.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Post Update Tab */}
            <TabsContent value="updates" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Share an Update</CardTitle>
                  <CardDescription>Keep your supporters informed about campaign progress.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Update Title</Label>
                    <Input placeholder="e.g., We've reached 50% of our goal!" value={updateTitle} onChange={(e) => setUpdateTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Update Content</Label>
                    <Textarea placeholder="Share the latest news..." rows={6} value={updateContent} onChange={(e) => setUpdateContent(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Add Image (Optional)</Label>
                    {mediaPreview ? (
                      <div className="relative">
                        <img src={mediaPreview} alt="Preview" className="w-full h-48 object-contain rounded-lg border bg-muted/30" />
                        <button type="button" onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                          className="absolute top-2 right-2 bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-destructive/80">
                          ✕
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                        <ImagePlus className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm font-medium">Click to upload an image</p>
                        <p className="text-xs mt-1">JPG, PNG, GIF up to 5MB</p>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return; }
                          setMediaFile(file);
                          setMediaPreview(URL.createObjectURL(file));
                        }} />
                      </label>
                    )}
                  </div>
                  <Button onClick={handlePostUpdate} disabled={isPostingUpdate || isUploadingMedia} className="w-full">
                    {isUploadingMedia ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading image...</>
                      : isPostingUpdate ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Publishing...</>
                        : <><Send className="w-4 h-4 mr-2" /> Publish Update</>}
                  </Button>
                </CardContent>
              </Card>
              {updates.length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Previous Updates</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    {updates.map((update: any) => (
                      <div key={update.id} className="border rounded-lg p-4">
                        <p className="font-semibold">{update.title}</p>
                        <p className="text-xs text-muted-foreground">{new Date(update.created_at).toLocaleDateString()}</p>
                        <p className="text-sm mt-2 whitespace-pre-wrap">{update.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Rewards Tab */}
            <TabsContent value="rewards" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Token Rewards</CardTitle>
                  <CardDescription>Stake token rewards automatically distributed to donors on withdrawal</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-5 bg-blue-50 border border-blue-200 rounded-xl">
                    <p className="font-semibold text-blue-800 flex items-center gap-2 mb-1">
                      🪙 Automatic Stake Token Reward
                      <span className="text-xs font-normal bg-blue-100 px-2 py-0.5 rounded-full">Always active</span>
                    </p>
                    <p className="text-sm text-blue-700">
                      Every donor automatically receives this campaign's unique stake token — <strong>1 ETH donated = 100 tokens</strong>.
                      Tokens are minted when you withdraw and are freely transferable on any platform.
                    </p>
                  </div>
                  {campaign.onChainId ? (
                    <ExtraFdyRewardCard onChainId={campaign.onChainId} />
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Campaign not yet on-chain.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Stakeholders Tab */}
            <TabsContent value="stakeholders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Stakeholder List</CardTitle>
                  <CardDescription>
                    On-chain stake token holders for this campaign, sorted by largest stake.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {campaign.onChainId ? (
                    <StakeholdersPanel onChainId={campaign.onChainId} />
                  ) : (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                      <p>Campaign not yet registered on-chain.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <CancelRequestDialog
        open={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onSubmitted={handleCancelSubmit}
        existingRequest={cancelRequest}
      />
    </div>
  );
}