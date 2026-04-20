import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Users,
  CheckCircle,
  ArrowLeft,
  Clock,
  ShieldCheck,
  Share2,
  Heart,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
  Gift,
  FileText,
  Megaphone,
  Flag,
} from 'lucide-react';
import { Campaign, ROUTE_PATHS } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { useCampaign } from '@/hooks/useCampaigns';
import { getCampaignUpdates, submitReport } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useWeb3, CROWDFUNDING_ABI, CONTRACT_ADDRESSES } from '@/context/Web3Context';
import { ethers } from 'ethers';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { SocialShare } from '@/components/SocialShare';
import { DonationForm } from '@/components/Forms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { provider, isConnected } = useWeb3();
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReasonType, setReportReasonType] = useState<'spam' | 'fraud' | 'inappropriate' | 'other'>('fraud');
  const [reportDetail, setReportDetail] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [updates, setUpdates] = useState<any[]>([]);
  const [onChainDonors, setOnChainDonors] = useState<any[]>([]);
  const { campaign, isLoading, rewardTiers } = useCampaign(id ?? '');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (id) {
      getCampaignUpdates(id).then(setUpdates).catch(() => setUpdates([]));
    }
  }, [id]);

  // Fetch on-chain donors — retry up to 3 times, look up Supabase names
  useEffect(() => {
    if (!campaign?.onChainId || !provider) return;

    let cancelled = false;
    const fetchDonors = async (attempt = 0) => {
      try {
        const contract = new ethers.Contract(
          CONTRACT_ADDRESSES.crowdfunding,
          CROWDFUNDING_ABI,
          provider,
        );
        const filter = contract.filters.DonationReceived(campaign.onChainId);
        const events = await contract.queryFilter(filter, 0, 'latest');
        if (cancelled) return;

        const seen = new Set<string>();
        const donors = await Promise.all(
          events.map(async (e: any) => {
            if (seen.has(e.args.donor)) return null;
            seen.add(e.args.donor);
            let date: Date | null = null;
            try {
              const block = await provider.getBlock(e.blockNumber);
              if (block) date = new Date(Number(block.timestamp) * 1000);
            } catch {}
            return {
              address:  e.args.donor as string,
              amount:   ethers.formatEther(e.args.amount),
              amountRm: (Number(ethers.formatEther(e.args.amount)) / 0.001).toFixed(0),
              date,
              txHash:   e.transactionHash,
              name:     null as string | null, // will be filled below
            };
          }),
        );

        const filtered = donors.filter(Boolean) as any[];

        // Look up Supabase usernames for wallets that are bound
        if (filtered.length > 0) {
          try {
            const { supabase } = await import('@/lib/supabase');
            const addresses = filtered.map(d => d.address.toLowerCase());
            const { data } = await supabase
              .from('profiles')
              .select('name, wallet_address')
              .in('wallet_address', addresses);

            if (data) {
              const nameMap: Record<string, string> = {};
              data.forEach((p: any) => {
                if (p.wallet_address) nameMap[p.wallet_address.toLowerCase()] = p.name;
              });
              filtered.forEach(d => {
                d.name = nameMap[d.address.toLowerCase()] ?? null;
              });
            }
          } catch {}
        }

        if (!cancelled) setOnChainDonors(filtered.reverse());
      } catch (err) {
        if (!cancelled && attempt < 3) {
          setTimeout(() => fetchDonors(attempt + 1), 1500);
        }
      }
    };

    fetchDonors();
    return () => { cancelled = true; };
  }, [campaign?.onChainId, provider]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="w-16 h-16 text-muted-foreground mb-4 opacity-20" />
        <h2 className="text-2xl font-bold mb-2">Campaign Not Found</h2>
        <p className="text-muted-foreground mb-6">The campaign you are looking for might have been removed or is temporarily unavailable.</p>
        <Button onClick={() => navigate(ROUTE_PATHS.CAMPAIGNS)} variant="outline">
          <ArrowLeft className="mr-2 w-4 h-4" />
          {t('btn_view_all')}
        </Button>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));
  const progressPercent = Math.min(100, Math.floor((campaign.currentAmount / campaign.goalAmount) * 100));
  const isVerified = campaign.organizer.isVerified;
  const isOwnCampaign = !!user && user.id === campaign.organizer.id;

  const handleSubmitReport = async () => {
    setIsSubmittingReport(true);
    try {
      await submitReport({
        campaign_id: campaign.id,
        reporter_id: user?.id ?? null,
        reason_type: reportReasonType,
        reason_detail: reportDetail.trim() || null,
      });
      toast.success('Report submitted. Our team will review it shortly.');
      setIsReportOpen(false);
      setReportDetail('');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to submit report');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  // Group reward tiers by type for vertical sub-tabs
  const tiersByType = rewardTiers && rewardTiers.length > 0
    ? rewardTiers.reduce((acc: Record<string, any[]>, tier: any) => {
        const key = tier.type ?? 'Other';
        if (!acc[key]) acc[key] = [];
        acc[key].push(tier);
        return acc;
      }, {})
    : {};
  const tierTypeKeys = Object.keys(tiersByType);

  return (
    <div className="min-h-screen pb-20">
      {/* Breadcrumbs */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link to={ROUTE_PATHS.HOME} className="hover:text-primary transition-colors">{t('nav_home')}</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to={ROUTE_PATHS.CAMPAIGNS} className="hover:text-primary transition-colors">{t('nav_campaigns')}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium line-clamp-1">{campaign.title}</span>
          </nav>
        </div>
      </div>

      {/* Unverified organizer warning banner */}
      {!isVerified && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="container mx-auto px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Caution:</span> The organizer of this campaign has not been verified by Fundy. We recommend researching the cause carefully before donating. Verified organizers display a{' '}
              <span className="inline-flex items-center gap-1 font-medium"><CheckCircle className="w-3.5 h-3.5 text-primary" /> verified badge</span>.
            </p>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 mt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Content */}
          <div className="lg:col-span-8 space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl mb-8 group">
                <img
                  src={campaign.image}
                  alt={campaign.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute top-6 left-6">
                  <Badge className="bg-primary text-primary-foreground px-4 py-1.5 text-sm shadow-lg">
                    {campaign.category}
                  </Badge>
                </div>
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-6 text-balance">
                {campaign.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-sm mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/20">
                    <img
                      src={campaign.organizer.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${campaign.organizer.name}`}
                      alt={campaign.organizer.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('label_organizer')}</p>
                    <div className="flex items-center gap-1 font-semibold text-foreground">
                      {campaign.organizer.name}
                      {isVerified ? (
                        <span className="flex items-center gap-1 text-primary text-xs font-medium ml-1">
                          <CheckCircle className="w-4 h-4 text-primary" /> Verified
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-600 text-xs font-medium ml-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Unverified
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Separator orientation="vertical" className="hidden md:block h-10" />

                <div className="flex flex-col">
                  <p className="text-muted-foreground">{t('stats_donors')}</p>
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    <Users className="w-4 h-4 text-primary" />
                    {campaign.donorCount.toLocaleString()}
                  </div>
                </div>

                <Separator orientation="vertical" className="hidden md:block h-10" />

                <div className="flex flex-col">
                  <p className="text-muted-foreground">{t('label_days_left')}</p>
                  <div className="flex items-center gap-1 font-semibold text-foreground">
                    <Clock className="w-4 h-4 text-primary" />
                    {daysLeft}
                  </div>
                </div>
              </div>

              {/* ── 3-tab content area ─────────────────────────── */}
              <Tabs defaultValue="description" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="description" className="gap-2">
                    <FileText className="w-4 h-4" /> Description
                  </TabsTrigger>
                  <TabsTrigger value="rewards" className="gap-2">
                    <Gift className="w-4 h-4" /> Rewards
                  </TabsTrigger>
                  <TabsTrigger value="updates" className="gap-2">
                    <Megaphone className="w-4 h-4" />
                    Updates
                    {updates.length > 0 && (
                      <Badge className="ml-1 h-5 px-1.5 text-[10px]">{updates.length}</Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                {/* Description tab */}
                <TabsContent value="description">
                  <div className="prose prose-lg dark:prose-invert max-w-none">
                    <p className="text-xl font-medium text-muted-foreground mb-8 leading-relaxed italic">
                      &ldquo;{campaign.shortDescription}&rdquo;
                    </p>
                    <div className="space-y-6 text-foreground/80 leading-relaxed">
                      {campaign.description.split('\n').map((paragraph, idx) => (
                        <p key={idx}>{paragraph}</p>
                      ))}
                    </div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="bg-accent/30 rounded-2xl p-8 border border-accent/50 mt-8"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="p-3 bg-primary/10 rounded-full text-primary">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">Donation Guarantee</h3>
                        <p className="text-sm text-muted-foreground">Your donation is protected by Fundy's security protocols.</p>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed">
                      Every contribution to this campaign is monitored and verified. We ensure that 95% of your funds go directly to the cause, with 5% supporting platform maintenance and secure payment processing.
                    </p>
                  </motion.div>
                </TabsContent>

                {/* Rewards tab */}
                <TabsContent value="rewards">
                  {!rewardTiers || rewardTiers.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No reward tiers for this campaign.</p>
                      <p className="text-sm mt-1">The organizer has not set up donation rewards yet.</p>
                    </div>
                  ) : tierTypeKeys.length > 1 ? (
                    // Multiple types → vertical sub-tabs
                    <div className="flex gap-6">
                      <Tabs defaultValue={tierTypeKeys[0]} orientation="vertical" className="flex gap-6 w-full">
                        <TabsList className="flex flex-col h-auto w-36 shrink-0 bg-muted/50 p-1 rounded-xl">
                          {tierTypeKeys.map((type) => (
                            <TabsTrigger key={type} value={type} className="w-full justify-start text-xs capitalize">
                              {type === 'ERC20' ? '🪙 Token' : type === 'ERC721' ? '🖼️ NFT' : type === 'badge' ? '🏅 Badge' : type}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                        <div className="flex-1">
                          {tierTypeKeys.map((type) => (
                            <TabsContent key={type} value={type} className="mt-0 space-y-3">
                              {tiersByType[type].map((tier: any) => (
                                <RewardTierCard key={tier.id} tier={tier} />
                              ))}
                            </TabsContent>
                          ))}
                        </div>
                      </Tabs>
                    </div>
                  ) : (
                    // Single type — just list them
                    <div className="space-y-4">
                      {rewardTiers.map((tier: any) => (
                        <RewardTierCard key={tier.id} tier={tier} />
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Updates tab */}
                <TabsContent value="updates">
                  {updates.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p className="font-medium">No updates posted yet.</p>
                      <p className="text-sm mt-1">The organizer will post progress updates here.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {updates.map((update: any, idx: number) => (
                        <motion.div
                          key={update.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="relative pl-6 border-l-2 border-primary/20"
                        >
                          <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full bg-primary/20 border-2 border-primary/40" />
                          <div className="flex items-baseline justify-between mb-1">
                            <h4 className="font-bold">{update.title}</h4>
                            <span className="text-xs text-muted-foreground ml-4 shrink-0">
                              {new Date(update.created_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          {update.author_name && (
                            <p className="text-xs text-muted-foreground mb-2">Posted by {update.author_name}</p>
                          )}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/80">{update.content}</p>
                          {update.image_url && (
                            <img
                              src={update.image_url}
                              alt={update.title}
                              className="mt-3 rounded-xl w-full max-h-56 object-contain border bg-muted/20"
                            />
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </motion.div>
          </div>

          {/* Right Column: Sticky Stats & Action */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 space-y-6">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Card className="overflow-hidden border-2 border-primary/10 shadow-xl">
                  <CardContent className="p-6 space-y-6">
                    <ProgressBar
                      current={campaign.currentAmount}
                      goal={campaign.goalAmount}
                    />

                    <div className="grid grid-cols-1 gap-4">
                      <Button
                        size="lg"
                        className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
                        onClick={() => {
                          if (!user) {
                            toast.error('Please log in to donate.');
                            return;
                          }
                          setIsDonationOpen(true);
                        }}
                      >
                        <Heart className="mr-2 w-5 h-5 fill-current" />
                        {t('btn_donate')}
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full h-14 text-lg font-bold"
                      >
                        <Share2 className="mr-2 w-5 h-5" />
                        {t('btn_share')}
                      </Button>
                    </div>

                    <div className="bg-muted/50 rounded-xl p-4">
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>Campaign ends on {new Date(campaign.endDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="pt-4">
                      <h4 className="font-bold mb-4 flex items-center gap-2">
                        <Share2 className="w-4 h-4 text-primary" />
                        Share this campaign
                      </h4>
                      <SocialShare campaign={campaign} />
                    </div>

                    {/* Report button — not shown to the organizer themselves */}
                    {!isOwnCampaign && (
                      <button
                        onClick={() => setIsReportOpen(true)}
                        className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-destructive transition-colors pt-2"
                      >
                        <Flag className="w-3 h-3" /> Report this campaign
                      </button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Donors Peek (Mock) */}
              <Card className="border-dashed">
                <CardContent className="p-6">
                  <h4 className="font-bold mb-4">
                    Recent Support
                    {onChainDonors.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({onChainDonors.length} donors)
                      </span>
                    )}
                  </h4>
                  {onChainDonors.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="text-sm">
                        {campaign?.onChainId
                          ? 'No donations yet. Be the first!'
                          : 'Campaign not yet on-chain.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {onChainDonors.slice(0, 5).map((donor, i) => (
                        <div key={donor.address} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            {/* Show donor name if they have a Supabase account, else Anonymous */}
                            <p className="text-sm font-semibold">
                              {donor.name ?? 'Anonymous'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              RM{donor.amountRm} · {donor.date ? donor.date.toLocaleDateString() : '—'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Donation Modal */}
      <Dialog open={isDonationOpen} onOpenChange={setIsDonationOpen}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-3xl">
          <div className="bg-primary p-6 text-primary-foreground">
            <h3 className="text-2xl font-bold">{t('btn_donate')}</h3>
            <p className="opacity-90 text-sm">Supporting: {campaign.title}</p>
          </div>
          <div className="p-6">
            <DonationForm campaign={campaign} onClose={() => setIsDonationOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Report Modal */}
      <Dialog open={isReportOpen} onOpenChange={setIsReportOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Flag className="w-4 h-4" /> Report this Campaign
            </DialogTitle>
            <DialogDescription>
              Our team will review your report within 1–3 business days. Please only report genuine concerns.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason</label>
              <Select value={reportReasonType} onValueChange={(v: any) => setReportReasonType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fraud">🚨 Fraud or Scam</SelectItem>
                  <SelectItem value="spam">📢 Spam or Misleading</SelectItem>
                  <SelectItem value="inappropriate">⚠️ Inappropriate Content</SelectItem>
                  <SelectItem value="other">💬 Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Additional Details <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea
                placeholder="Please describe your concern..."
                rows={3}
                value={reportDetail}
                onChange={(e) => setReportDetail(e.target.value)}
              />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setIsReportOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
              >
                {isSubmittingReport
                  ? <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</span>
                  : 'Submit Report'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Reward Tier Card sub-component ────────────────────────────

function RewardTierCard({ tier }: { tier: any }) {
  const typeLabel: Record<string, string> = {
    ERC20: '🪙 Token Reward',
    ERC721: '🖼️ NFT Reward',
    badge: '🏅 Badge',
  };
  return (
    <div className="border rounded-xl p-5 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-bold">{tier.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{typeLabel[tier.type] ?? tier.type}</p>
        </div>
        <Badge variant="outline" className="shrink-0 text-sm font-semibold">
          RM{tier.minAmount}+
        </Badge>
      </div>
      {tier.description && (
        <p className="text-sm text-foreground/70 mt-2">{tier.description}</p>
      )}
      {tier.quantity && (
        <p className="text-xs text-muted-foreground mt-2">Limited to {tier.quantity} supporters</p>
      )}
      {tier.tokenAmount && (
        <p className="text-xs text-primary font-medium mt-1">+{tier.tokenAmount} tokens</p>
      )}
    </div>
  );
}
