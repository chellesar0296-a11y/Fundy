// Rewards.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Gift, Coins, Image as ImageIcon, CheckCircle2, Clock,
  Loader2, Star, Zap, Lock, Share2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { useNavigate } from 'react-router-dom';
import { useWeb3, CONTRACT_ADDRESSES, NFT_ABI } from '@/context/Web3Context';
import { ethers } from 'ethers';
import { ROUTE_PATHS, Reward, CreditScore } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

const LEVEL_COLORS: Record<string, string> = {
  Bronze: 'text-amber-700 bg-amber-100 border-amber-200',
  Silver: 'text-slate-600 bg-slate-100 border-slate-200',
  Gold: 'text-yellow-700 bg-yellow-100 border-yellow-200',
  Platinum: 'text-violet-700 bg-violet-100 border-violet-200',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  ERC721: ImageIcon, ERC20: Coins, badge: Gift, physical: Gift,
};

const TYPE_LABEL: Record<string, string> = {
  ERC721: 'NFT', ERC20: 'Token', badge: 'Badge', physical: 'Physical',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  minted: 'bg-blue-100 text-blue-700',
  claimed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
};

// ── Credit Score ──────────────────────────────────────────────
function CreditScoreCard({ score }: { score: CreditScore }) {
  const pct = Math.min((score.score / 1000) * 100, 100);
  return (
    <Card className="overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-amber-400 via-yellow-400 to-violet-500" style={{ width: `${pct}%` }} />
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Credit Score</p>
            <p className="text-4xl font-extrabold mt-1">{score.score}<span className="text-lg text-muted-foreground">/1000</span></p>
          </div>
          <Badge className={`text-sm px-3 py-1 border ${LEVEL_COLORS[score.level]}`}>
            <Star className="w-3.5 h-3.5 mr-1" /> {score.level}
          </Badge>
        </div>
        <Progress value={pct} className="h-2 mb-5" />
        <div className="grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-2xl font-bold">RM{score.totalDonations.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Donated</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{score.campaignsSupported}</p>
            <p className="text-xs text-muted-foreground">Campaigns</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{score.streakDays}</p>
            <p className="text-xs text-muted-foreground">Streak Days</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Reward Card ───────────────────────────────────────────────
function RewardCard({ reward, onClaim, isLoggedIn, userName }: {
  reward: Reward;
  onClaim: (id: string) => Promise<void>;
  isLoggedIn: boolean;
  userName?: string;
}) {
  const Icon = TYPE_ICON[reward.type] ?? Gift;
  const [claiming, setClaiming] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const handleClaim = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isLoggedIn) { toast.error('Please log in to claim rewards.'); return; }
    if (reward.status === 'claimed') { toast.info('Already claimed!'); return; }
    if (reward.status !== 'minted') { toast.info('Not ready to claim yet.'); return; }
    setClaiming(true);
    try {
      await onClaim(reward.id);
      toast.success(`${reward.name} claimed! 🎉`);
    } catch {
      toast.error('Failed to claim. Please try again.');
    } finally {
      setClaiming(false);
    }
  };

  const handleShare = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = `🎖️ I just earned "${reward.name}" on Fundy!\n\nI donated to "${reward.campaignTitle}" and received this reward.${userName ? `\n\n— ${userName}` : ''}\n\nJoin me on Fundy! 🌟`;
    if (navigator.share) {
      navigator.share({ title: `Fundy Reward — ${reward.name}`, text }).catch(() => { });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('Share text copied to clipboard!');
    }
  };

  const bgColor = reward.status === 'claimed' ? 'bg-emerald-50' : reward.status === 'minted' ? 'bg-blue-50' : 'bg-muted/40';
  const iconColor = reward.status === 'claimed' ? 'text-emerald-500' : reward.status === 'minted' ? 'text-blue-500' : 'text-muted-foreground';

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <Card
          className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${reward.status === 'claimed' ? 'opacity-90' : ''}`}
          onClick={() => setShowDetail(true)}
        >
          <div className={`h-28 flex items-center justify-center ${bgColor}`}>
            {reward.imageUrl
              ? <img src={reward.imageUrl} alt={reward.name} className="h-full w-full object-cover" />
              : <div className="p-4 rounded-full bg-white/60"><Icon className={`w-10 h-10 ${iconColor}`} /></div>
            }
          </div>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm line-clamp-1">{reward.name}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{reward.campaignTitle}</p>
              </div>
              <span className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[reward.status] ?? ''}`}>
                {reward.status === 'minted' ? 'Ready' : reward.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">{TYPE_LABEL[reward.type] ?? reward.type}</Badge>
              {reward.tokenAmount && <Badge variant="secondary" className="text-xs">+{reward.tokenAmount} FDY</Badge>}
            </div>
            {reward.status === 'minted' && (
              <Button size="sm" className="w-full" onClick={handleClaim} disabled={claiming || !isLoggedIn}>
                {claiming ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Claiming...</>
                  : !isLoggedIn ? <><Lock className="w-3 h-3 mr-1" />Login to Claim</>
                    : <><Zap className="w-3 h-3 mr-1" />Claim Reward</>}
              </Button>
            )}
            {reward.status === 'claimed' && (
              <p className="text-center text-xs text-emerald-600 font-medium py-1 flex items-center justify-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {reward.claimedAt ? `Claimed ${new Date(reward.claimedAt).toLocaleDateString()}` : 'Claimed'}
              </p>
            )}
            {reward.status === 'pending' && (
              <p className="text-center text-xs text-amber-600 font-medium py-1 flex items-center justify-center gap-1">
                <Clock className="w-3.5 h-3.5" />Awaiting mint...
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail + Share Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{reward.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className={`h-40 rounded-xl flex items-center justify-center ${bgColor}`}>
              {reward.imageUrl
                ? <img src={reward.imageUrl} alt={reward.name} className="h-full w-full object-contain rounded-xl" />
                : <div className="p-6 rounded-full bg-white/60"><Icon className={`w-16 h-16 ${iconColor}`} /></div>
              }
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{TYPE_LABEL[reward.type] ?? reward.type}</Badge>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[reward.status] ?? ''}`}>
                  {reward.status === 'minted' ? 'Ready to Claim' : reward.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{reward.description || 'No description.'}</p>
              <p className="text-xs text-muted-foreground">
                Campaign: <span className="font-medium text-foreground">{reward.campaignTitle}</span>
              </p>
              {reward.tokenAmount && <p className="text-sm font-semibold text-primary">+{reward.tokenAmount} FDY tokens</p>}
              {reward.claimedAt && (
                <p className="text-xs text-muted-foreground">
                  Claimed on {new Date(reward.claimedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Share preview */}
            {(reward.status === 'claimed' || reward.status === 'minted') && (
              <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground whitespace-pre-line font-mono">
                {`🎖️ I earned "${reward.name}" on Fundy!\nI donated to "${reward.campaignTitle}".${userName ? `\n— ${userName}` : ''}`}
              </div>
            )}

            <div className="flex gap-2">
              {reward.status === 'minted' && (
                <Button className="flex-1" onClick={handleClaim} disabled={claiming || !isLoggedIn}>
                  {claiming ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                  Claim
                </Button>
              )}
              {(reward.status === 'claimed' || reward.status === 'minted') && (
                <Button variant="outline" className="flex-1" onClick={handleShare}>
                  <Share2 className="w-4 h-4 mr-2" /> Share
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function Rewards() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { rewards, creditScore, isLoading, claimReward } = useRewards(user?.id);
  const { isConnected, isConnecting, address, fdyBalance, ethBalance, connect, provider } = useWeb3();
  const navigate = useNavigate();

  // Fetch on-chain NFTs owned by connected wallet
  const [onChainNfts, setOnChainNfts] = useState<any[]>([]);
  useEffect(() => {
    if (!isConnected || !address || !provider) return;
    if (CONTRACT_ADDRESSES.nft === '0x0000000000000000000000000000000000000000') return;
    const nftContract = new ethers.Contract(CONTRACT_ADDRESSES.nft, NFT_ABI, provider);
    nftContract.balanceOf(address).then(async (bal: any) => {
      const count = Number(bal);
      const nfts = [];
      for (let i = 0; i < Math.min(count, 20); i++) {
        try {
          const tokenId = await nftContract.tokenOfOwnerByIndex(address, i);
          const uri = await nftContract.tokenURI(tokenId);
          nfts.push({ tokenId: Number(tokenId), uri });
        } catch { }
      }
      setOnChainNfts(nfts);
    }).catch(() => { });
  }, [isConnected, address, provider]);

  if (authLoading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }
  // Early return AFTER all hooks — auth gate
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-accent/20 p-6 rounded-full mb-6">
          <Gift className="w-16 h-16 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Authentication Required</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Please log in to view your rewards and claim your FDY tokens.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate(ROUTE_PATHS.LOGIN)} size="lg">
            Log In
          </Button>
          <Button onClick={() => navigate(ROUTE_PATHS.HOME)} variant="outline" size="lg">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  if (isAuthenticated && !isConnected) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="text-center py-20 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Reconnecting wallet...</p>
        <p className="text-xs text-muted-foreground mt-2">
          Taking too long?{' '}
          <button onClick={connect} className="text-primary hover:underline">
            Connect manually
          </button>
        </p>
      </div>
    </div>
  );
}

  const pendingCount = rewards.filter(r => r.status === 'pending').length;
  const mintedCount = rewards.filter(r => r.status === 'minted').length;
  const claimedCount = rewards.filter(r => r.status === 'claimed').length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
            <Gift className="w-8 h-8 text-primary" /> Rewards
          </h1>
          <p className="text-muted-foreground">
            Every donation earns FDY tokens and on-chain rewards.
            {!isAuthenticated && ' Log in to claim yours.'}
          </p>
        </div>

        {/* Login prompt — soft banner */}
        {!isAuthenticated && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Log in to claim your rewards</p>
                  <p className="text-xs text-muted-foreground">Browse rewards below — claiming requires an account.</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate(ROUTE_PATHS.LOGIN)}>Log In</Button>
            </CardContent>
          </Card>
        )}

        {/* Wallet banner */}
        <Card className={`border-2 ${isConnected ? 'border-emerald-200 bg-emerald-50/40' : 'border-primary/20'}`}>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
            {isConnected ? (
              <div>
                <p className="font-semibold text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Wallet connected
                </p>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">{address?.slice(0, 10)}...{address?.slice(-6)}</p>
                <p className="text-sm mt-1 font-semibold">{ethBalance} ETH · <span className="text-primary">{Number(fdyBalance).toFixed(2)} FDY</span></p>
              </div>
            ) : (
              <div>
                <p className="font-semibold">Connect your MetaMask wallet</p>
                <p className="text-sm text-muted-foreground mt-0.5">Required to mint and claim on-chain rewards.</p>
              </div>
            )}
            {!isConnected && <Button onClick={connect} className="gap-2 shrink-0">🦊 Connect MetaMask</Button>}
          </CardContent>
        </Card>

        {/* Credit score */}
        {isAuthenticated && creditScore && <CreditScoreCard score={creditScore} />}

        {/* Stats */}
        {isAuthenticated && rewards.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Pending', value: pendingCount, color: 'text-amber-600' },
              { label: 'Ready to Claim', value: mintedCount, color: 'text-blue-600' },
              { label: 'Claimed', value: claimedCount, color: 'text-emerald-600' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="py-4 text-center">
                  <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Rewards grid */}
        <div>
          <h2 className="font-bold text-lg mb-4">
            {isAuthenticated ? 'My Rewards' : 'How Rewards Work'}
          </h2>

          {!isAuthenticated ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Coins, title: 'Token Reward', desc: 'Earn FDY tokens for every donation. 1 ETH = 100 FDY.' },
                { icon: ImageIcon, title: 'NFT Collectible', desc: 'Large donations mint a unique NFT commemorating your support.' },
                { icon: Gift, title: 'Badge', desc: 'Digital badges for reaching donation milestones.' },
              ].map(({ icon: Icon, title, desc }) => (
                <Card key={title} className="border-dashed">
                  <CardContent className="p-5 text-center space-y-2">
                    <div className="inline-flex p-3 bg-muted rounded-full">
                      <Icon className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-sm">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : rewards.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center space-y-3 text-muted-foreground">
                <div className="inline-flex p-4 bg-muted rounded-full">
                  <Gift className="w-10 h-10 opacity-30" />
                </div>
                <p className="font-medium text-lg">No rewards yet</p>
                <p className="text-sm">Make your first donation to earn FDY tokens and rewards!</p>
                <Button variant="outline" onClick={() => navigate(ROUTE_PATHS.CAMPAIGNS)}>
                  Browse Campaigns
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rewards.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  onClaim={claimReward}
                  isLoggedIn={isAuthenticated}
                  userName={user?.name}
                />
              ))}
            </div>
          )}
        </div>

        {/* On-chain NFTs owned by wallet */}
        {onChainNfts.length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-violet-500" /> My NFTs (On-chain)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {onChainNfts.map((nft) => (
                <Card key={nft.tokenId} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="h-32 bg-violet-50 flex items-center justify-center">
                    <img
                      src={nft.uri}
                      alt={`NFT #${nft.tokenId}`}
                      className="h-full w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                  <CardContent className="p-3">
                    <p className="font-semibold text-sm">NFT #{nft.tokenId}</p>
                    <p className="text-xs text-muted-foreground truncate">{nft.uri}</p>
                    <Badge variant="outline" className="text-xs mt-1 text-violet-600 border-violet-200">
                      On-chain
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
