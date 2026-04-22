import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings,
  CreditCard,
  History,
  User,
  TrendingUp,
  Plus,
  ChevronRight,
  LogOut,
  Heart,
  ShieldCheck,
  LayoutDashboard,
  Megaphone,
  Gift,
  Coins,
  Image,
  Clock,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';
import { ROUTE_PATHS } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { useCampaigns } from '@/hooks/useCampaigns';
import { fetchUserDonations, fetchUserCampaigns, fetchUserRewards, DbReward } from '@/lib/supabase';
import { useWeb3, CROWDFUNDING_ABI, CONTRACT_ADDRESSES } from '@/context/Web3Context';
import { ethers } from 'ethers';
import { dbCampaignToFrontend } from '@/hooks/useCampaigns';
import { Campaign } from '@/lib/index';
import { CampaignCard, StatsCard } from '@/components/Cards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const springTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { user, isAuthenticated, logout, updateProfile, isLoading, refreshProfile } = useAuth();
  const { isConnected, address, provider, fdyBalance, ethBalance } = useWeb3();

  useEffect(() => {
    refreshProfile?.();
  }, []);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // On-chain transactions fetched from contract events
  const [onChainTxs, setOnChainTxs] = useState<any[]>([]);
  const [onChainLoading, setOnChainLoading] = useState(false);

  // ✅ All hooks MUST be called before any early returns (React rules of hooks)
  const { campaigns } = useCampaigns();
  const [userDonations, setUserDonations] = useState<any[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const isProfileDirty = profileName !== (user?.name ?? '') || profileBio !== (user?.bio ?? '');
  const [userCampaigns, setUserCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [userRewards, setUserRewards] = useState<(DbReward & { campaigns: { title: string } })[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      setProfileName(user.name ?? '');
      setProfileBio(user.bio ?? '');
    }
  }, [user?.id, user?.name, user?.bio]);

  useEffect(() => {
    if (!user) { setDonationsLoading(false); return; }
    setDonationsLoading(true);
    fetchUserDonations(user.id)
      .then((data) => {
        setUserDonations(data.map((d) => ({
          id: d.id,
          campaignId: d.campaign_id,
          campaignTitle: (d as any).campaigns?.title ?? 'Unknown Campaign',
          amount: Number(d.amount),
          date: d.created_at,
          status: 'Completed',
        })));
      })
      .catch(() => setUserDonations([]))
      .finally(() => setDonationsLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setCampaignsLoading(false); return; }
    setCampaignsLoading(true);
    fetchUserCampaigns(user.id)
      .then((data) => setUserCampaigns(data.map(dbCampaignToFrontend)))
      .catch(() => setUserCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, [user?.id]);

  useEffect(() => {
    if (!user) { setRewardsLoading(false); return; }
    setRewardsLoading(true);
    fetchUserRewards(user.id)
      .then((data) => setUserRewards(data))
      .catch(() => setUserRewards([]))
      .finally(() => setRewardsLoading(false));
  }, [user?.id]);

  // Fetch on-chain transactions for connected wallet (with retry)
  useEffect(() => {
    if (!isConnected || !address || !provider) return;
    if (CONTRACT_ADDRESSES.crowdfunding === '0x0000000000000000000000000000000000000000') return;

    let cancelled = false;
    setOnChainLoading(true);

    const fetchTxs = async (attempt = 0) => {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, provider);

        // My donations (as donor)
        const donorFilter = contract.filters.DonationReceived(null, address);
        const donorEvents = await contract.queryFilter(donorFilter, 0, 'latest');

        const txs = await Promise.all(donorEvents.map(async (e: any) => {
          try {
            const block = await provider.getBlock(e.blockNumber);
            return {
              type: 'donated',
              txHash: e.transactionHash,
              campaignId: Number(e.args.campaignId),
              amount: ethers.formatEther(e.args.amount),
              amountRm: (Number(ethers.formatEther(e.args.amount)) / 0.001).toFixed(2),
              tokens: ethers.formatEther(e.args.tokensAwarded),
              timestamp: block ? new Date(Number(block.timestamp) * 1000) : null,
            };
          } catch {
            return {
              type: 'donated',
              txHash: e.transactionHash,
              campaignId: Number(e.args.campaignId),
              amount: ethers.formatEther(e.args.amount),
              amountRm: (Number(ethers.formatEther(e.args.amount)) / 0.001).toFixed(2),
              tokens: '0',
              timestamp: null,
            };
          }
        }));

        if (!cancelled) {
          setOnChainTxs(txs.reverse());
          setOnChainLoading(false);
        }
      } catch (err) {
        if (!cancelled && attempt < 3) {
          setTimeout(() => fetchTxs(attempt + 1), 1500);
        } else if (!cancelled) {
          setOnChainLoading(false);
        }
      }
    };

    fetchTxs();
    return () => { cancelled = true; };
  }, [isConnected, address, provider]);

  // Early returns AFTER all hooks
  if (!isAuthenticated && !isLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-accent/20 p-6 rounded-full mb-6">
          <ShieldCheck className="w-16 h-16 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Authentication Required</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Please log in to access your personal dashboard and manage your contributions to global causes.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate(ROUTE_PATHS.LOGIN)} size="lg">
            {t('nav_login')}
          </Button>
          <Button onClick={() => navigate(ROUTE_PATHS.HOME)} variant="outline" size="lg">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const totalDonated = userDonations.reduce((sum, d) => sum + d.amount, 0);
  const livesImpacted = Math.floor(totalDonated / 25);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springTransition}
      >
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="text-2xl">{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {t('dashboard_welcome', { name: user.name })}
              </h1>
              <p className="text-muted-foreground mt-1">{user.role === 'admin' ? 'Administrator' : 'Donor'} • Member since {new Date(user.createdAt).getFullYear()}</p>
              <div className="flex items-center gap-4 mt-3">
                <Button variant="outline" size="sm" onClick={logout} className="text-destructive hover:bg-destructive/10">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Verification Banner */}
        {/* Show verified banner if either isVerified=true OR verificationStatus=approved */}
        {(user.isVerified || user.verificationStatus === 'approved') ? (
          <div className="mb-6 flex items-center gap-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-emerald-800">Account Verified ✓</p>
              <p className="text-xs text-emerald-700 mt-0.5">Your identity has been verified. A verified badge is displayed on your profile and campaigns.</p>
            </div>
          </div>
        ) : user.verificationStatus === 'pending' ? (
          <div className="mb-6 flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-amber-800">Verification Under Review</p>
              <p className="text-xs text-amber-700 mt-0.5">Your verification request has been submitted and is being reviewed by our team. This usually takes 1–3 business days.</p>
            </div>
          </div>
        ) : (
          <div className="mb-6 flex items-center justify-between gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-sm">Get Verified to Build Donor Trust</p>
                <p className="text-xs text-muted-foreground mt-0.5">Verified organizers display a badge on their campaigns and are more likely to receive donations.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/verify')}>
              Apply Now
            </Button>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <StatsCard
            title={t('dashboard_total_donated')}
            value={`RM${totalDonated.toLocaleString()}`}
            description="Thank you for your generosity"
          />
          <StatsCard
            title={t('dashboard_impact')}
            value={livesImpacted.toString()}
            description="Direct lives positively changed"
          />
          <StatsCard
            title="Active Support"
            value={userDonations.length.toString()}
            description="Campaigns you're following"
          />
        </div>

        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-8" onValueChange={setActiveTab}>
          <div className="flex justify-center md:justify-start overflow-x-auto pb-2">
            <TabsList className="bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg gap-2">
                <LayoutDashboard className="w-4 h-4" /> Overview
              </TabsTrigger>
              <TabsTrigger value="my-campaigns" className="rounded-lg gap-2">
                <Megaphone className="w-4 h-4" /> My Campaigns
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg gap-2">
                <History className="w-4 h-4" /> Donation History
              </TabsTrigger>
              <TabsTrigger value="settings" className="rounded-lg gap-2">
                <Settings className="w-4 h-4" /> Settings
              </TabsTrigger>
            </TabsList>
          </div>


          <TabsContent value="overview" className="mt-0">
            <motion.div
              key="overview"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={springTransition}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              {/* Recent Activities */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Recommended for You</h3>
                  <Link to={ROUTE_PATHS.CAMPAIGNS} className="text-primary text-sm font-medium hover:underline flex items-center">
                    See more <ChevronRight className="w-4 h-4 ml-1" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {campaigns.filter(c => c.organizer.id !== user.id).slice(0, 2).map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} />
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Heart className="w-5 h-5 text-destructive" />
                      Recent Donations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {donationsLoading ? (
                      <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                    ) : userDonations.length === 0 ? (
                      <p className="text-center text-muted-foreground py-6 text-sm">No donations yet. Support a cause to get started!</p>
                    ) : userDonations.map((donation) => (
                      <div key={donation.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-semibold group-hover:text-primary transition-colors">{donation.campaignTitle}</p>
                            <p className="text-xs text-muted-foreground">{new Date(donation.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">+RM{donation.amount}</p>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${donation.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {donation.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Stats/Promo */}
              <div className="space-y-6">
                <Card className="bg-primary text-primary-foreground overflow-hidden relative">
                  <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                  <CardHeader>
                    <CardTitle>Become an Organizer</CardTitle>
                    <CardDescription className="text-primary-foreground/80">
                      Have a cause that needs support? Start your own fundraising campaign on Fundy today.
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <Button variant="secondary" className="w-full" asChild>
                      <Link to={ROUTE_PATHS.CREATE_CAMPAIGN}>Start Campaign</Link>
                    </Button>
                  </CardFooter>
                </Card>

                {/* Rewards quick entry card - dynamic from DB */}
                <Card className="border-amber-200 bg-amber-50/40">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span>🎁</span> My Rewards & Score
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Every donation earns Token or NFT rewards
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0 pb-2">
                    {rewardsLoading ? (
                      <div className="flex justify-center py-2"><div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
                    ) : userRewards.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Donate to earn your first reward!</p>
                    ) : (
                      <div className="space-y-2">
                        {userRewards.map((r) => {
                          const Icon = r.type === 'ERC721' ? Image : r.type === 'ERC20' ? Coins : Gift;
                          const statusColor = r.status === 'claimed' ? 'bg-emerald-100 text-emerald-700' : r.status === 'minted' ? 'bg-blue-100 text-blue-700' : r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
                          return (
                            <div key={r.id} className="flex items-center gap-2 text-xs">
                              <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                                {r.image_url ? <img src={r.image_url} className="w-5 h-5 rounded-full object-contain" alt="" /> : <Icon className="w-3.5 h-3.5 text-amber-600" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{r.name}</p>
                                <p className="text-muted-foreground truncate">{r.campaigns?.title ?? ''}</p>
                              </div>
                              <span className={`shrink-0 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full ${statusColor}`}>{r.status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-0">
                    <Button variant="outline" size="sm" className="w-full border-amber-300 text-amber-700 hover:bg-amber-100" asChild>
                      <Link to="/rewards">View all rewards</Link>
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Impact Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Education Milestone</span>
                        <span className="font-medium">80%</span>
                      </div>
                      <Progress value={80} className="h-2" />
                      <p className="text-[10px] text-muted-foreground">You're helping 4 students complete this term!</p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Environmental Goal</span>
                        <span className="font-medium">45%</span>
                      </div>
                      <Progress value={45} className="h-2" />
                      <p className="text-[10px] text-muted-foreground">Your trees are currently being planted in the Amazon.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          </TabsContent>

          <TabsContent value="my-campaigns" className="mt-0">
            <motion.div
              key="my-campaigns"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springTransition}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold">My Campaigns</h3>
                  <p className="text-sm text-muted-foreground">Campaigns you've created and are managing</p>
                </div>
                <Button onClick={() => navigate(ROUTE_PATHS.CREATE_CAMPAIGN)} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> New Campaign
                </Button>
              </div>

              {campaignsLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : userCampaigns.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <div className="bg-primary/10 p-4 rounded-full mb-4">
                      <Megaphone className="w-10 h-10 text-primary" />
                    </div>
                    <p className="text-lg font-medium mb-1">No campaigns yet</p>
                    <p className="text-sm mb-6">Start a campaign to raise funds for a cause you care about.</p>
                    <Button onClick={() => navigate(ROUTE_PATHS.CREATE_CAMPAIGN)}>
                      <Plus className="w-4 h-4 mr-2" /> Start Your First Campaign
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {userCampaigns.map((campaign) => {
                    const pct = Math.min(100, Math.round((campaign.currentAmount / campaign.goalAmount) * 100));
                    const daysLeft = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / 86400000));
                    const statusColor = campaign.status === 'active' ? 'bg-emerald-100 text-emerald-700' : campaign.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600';
                    return (
                      <Card key={campaign.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                        <div className="relative h-40 overflow-hidden bg-muted">
                          <img
                            src={campaign.image}
                            alt={campaign.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute top-3 right-3">
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${statusColor}`}>
                              {campaign.status}
                            </span>
                          </div>
                        </div>
                        <CardContent className="p-4 space-y-3">
                          <div>
                            <p className="font-bold text-sm leading-tight line-clamp-2">{campaign.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{campaign.category}</p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span>RM{campaign.currentAmount.toLocaleString()} raised</span>
                              <span className="text-muted-foreground">{pct}%</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                            <div className="flex justify-between text-[10px] text-muted-foreground pt-0.5">
                              <span>Goal: RM{campaign.goalAmount.toLocaleString()}</span>
                              <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{daysLeft}d left</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-1">
                            <Button variant="outline" size="sm" className="flex-1 text-xs" asChild>
                              <Link to={`/campaign/${campaign.id}`}>View</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={() => navigate(`/campaign/${campaign.id}/manage`)}
                            >
                              <Settings className="w-3 h-3 mr-1" /> Manage
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="history" className="mt-0">
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Wallet info bar */}
              {isConnected && (
                <div className="flex items-center justify-between p-4 bg-primary/5 border border-primary/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🦊</span>
                    <div>
                      <p className="text-sm font-semibold">Connected Wallet</p>
                      <p className="font-mono text-xs text-muted-foreground">{address}</p>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-bold">{ethBalance} ETH</p>
                    <p className="text-primary font-semibold">{Number(fdyBalance).toFixed(0)} FDY</p>
                  </div>
                </div>
              )}

              {/* My Donations — what I sent to campaigns */}
              <div className="bg-card border rounded-xl overflow-hidden">
                <div className="p-5 border-b bg-muted/20">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Heart className="w-4 h-4 text-primary" /> My Donations
                  </h3>
                  <p className="text-sm text-muted-foreground">Contributions you made to campaigns, recorded on-chain.</p>
                </div>

                {!isConnected ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <div className="text-3xl">🦊</div>
                    <p className="font-medium">Connect your wallet to view donation history</p>
                  </div>
                ) : onChainLoading ? (
                  <div className="flex justify-center py-10">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : onChainTxs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p className="font-medium mb-1">No donations yet</p>
                    <p className="text-sm">Donations made with MetaMask will appear here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-muted-foreground border-b">
                        <tr>
                          <th className="px-5 py-3 text-left font-medium">Date</th>
                          <th className="px-5 py-3 text-left font-medium">Campaign #</th>
                          <th className="px-5 py-3 text-left font-medium">Amount</th>
                          <th className="px-5 py-3 text-left font-medium">FDY Earned</th>
                          <th className="px-5 py-3 text-left font-medium">Tx Hash</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {onChainTxs.map((tx) => (
                          <tr key={tx.txHash} className="hover:bg-muted/30 transition-colors">
                            <td className="px-5 py-3 whitespace-nowrap text-muted-foreground">
                              {tx.timestamp ? tx.timestamp.toLocaleDateString() : '—'}
                            </td>
                            <td className="px-5 py-3 font-medium">Campaign #{tx.campaignId}</td>
                            <td className="px-5 py-3">
                              <span className="font-semibold">RM{tx.amountRm}</span>
                              <span className="text-xs text-muted-foreground ml-1">({Number(tx.amount).toFixed(5)} ETH)</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="text-primary font-semibold">+{Number(tx.tokens).toFixed(2)} FDY</span>
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-mono text-xs text-muted-foreground" title={tx.txHash}>
                                {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-6)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Campaigns I organised — donations received */}
              {userCampaigns.length > 0 && (
                <div className="bg-card border rounded-xl overflow-hidden">
                  <div className="p-5 border-b bg-muted/20">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-primary" /> Donations Received
                    </h3>
                    <p className="text-sm text-muted-foreground">Contributions received by your campaigns.</p>
                  </div>
                  <div className="divide-y">
                    {userCampaigns.filter(c => c.donorCount > 0).length === 0 ? (
                      <div className="text-center py-10 text-muted-foreground">
                        <p className="text-sm">No donations received yet on your campaigns.</p>
                      </div>
                    ) : (
                      userCampaigns.filter(c => c.donorCount > 0).map((campaign) => (
                        <div key={campaign.id} className="p-4 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm line-clamp-1">{campaign.title}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{campaign.donorCount} donors</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-emerald-600">RM{campaign.currentAmount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">of RM{campaign.goalAmount.toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <motion.div
              key="settings"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Update your personal details and how you appear on Fundy.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input id="name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input id="email" defaultValue={user.email} disabled />
                      <p className="text-[10px] text-muted-foreground italic">Email cannot be changed for security.</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea
                      id="bio"
                      className="w-full min-h-[100px] bg-background border rounded-md p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                      value={profileBio}
                      onChange={(e) => setProfileBio(e.target.value)}
                      placeholder="Tell the community about why you support Fundy..."
                    />
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button
                    variant="outline"
                    disabled={!isProfileDirty || isSavingProfile}
                    onClick={() => {
                      setProfileName(user.name ?? '');
                      setProfileBio(user.bio ?? '');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    disabled={!isProfileDirty || isSavingProfile}
                    onClick={() => setShowSaveConfirm(true)}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Changes'}
                  </Button>
                </CardFooter>
              </Card>
              <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Save profile changes?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will update your public profile. The following changes will be saved:
                      {profileName !== (user.name ?? '') && (
                        <span className="block mt-2 text-foreground">
                          <span className="font-medium">Name:</span>{' '}
                          <span className="line-through text-muted-foreground">{user.name}</span>{' '}
                          → <span className="font-medium">{profileName}</span>
                        </span>
                      )}
                      {profileBio !== (user.bio ?? '') && (
                        <span className="block mt-1 text-foreground">
                          <span className="font-medium">Bio:</span>{' '}
                          {profileBio ? `"${profileBio}"` : <em className="text-muted-foreground">cleared</em>}
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        setIsSavingProfile(true);
                        try {
                          await updateProfile({ name: profileName, bio: profileBio });
                          toast.success('Profile updated!');
                        } catch {
                          toast.error('Failed to update profile');
                        } finally {
                          setIsSavingProfile(false);
                        }
                      }}
                    >
                      Confirm Save
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </motion.div>
          </TabsContent>

          <TabsContent value="impact" className="mt-0">
            <motion.div
              key="impact"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Your Global Impact Journey</CardTitle>
                  <CardDescription>Visualizing the change you've created in 2026.</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px] flex items-center justify-center bg-muted/10 rounded-xl border-2 border-dashed border-muted">
                  <div className="text-center space-y-3">
                    <div className="inline-flex p-4 bg-primary/10 rounded-full">
                      <TrendingUp className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-muted-foreground">Impact visualization and geographical heatmaps are being generated...</p>
                    <Button variant="outline">Request Impact Report</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Categories You Support</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { cat: 'Education', val: 65, color: 'bg-blue-500' },
                    { cat: 'Medical', val: 25, color: 'bg-rose-500' },
                    { cat: 'Environment', val: 10, color: 'bg-emerald-500' }
                  ].map((item) => (
                    <div key={item.cat} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span>{item.cat}</span>
                        <span>{item.val}%</span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }}></div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Community Recognition</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  <div className="group relative">
                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center border-2 border-amber-200 cursor-help">
                      <Heart className="w-8 h-8 text-amber-600" />
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-popover text-popover-foreground text-[10px] rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-center">
                      "First Heart" Badge: Donated to 3+ campaigns
                    </div>
                  </div>
                  <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center border-2 border-dashed border-muted">
                    <Plus className="w-6 h-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
