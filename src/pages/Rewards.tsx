// Rewards.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Gift, Coins, Image as ImageIcon, ShieldCheck, CheckCircle2, Clock, Loader2, Star, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRewards } from '@/hooks/useRewards';
import { useWallet } from '@/hooks/useWallet';
import { useLanguage } from '@/hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS, Reward, CreditScore } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const LEVEL_COLORS: Record<string, string> = {
  Bronze:   'text-amber-700 bg-amber-100 border-amber-200',
  Silver:   'text-slate-600 bg-slate-100 border-slate-200',
  Gold:     'text-yellow-700 bg-yellow-100 border-yellow-200',
  Platinum: 'text-violet-700 bg-violet-100 border-violet-200',
};

const TYPE_ICON: Record<string, React.ElementType> = {
  ERC721: ImageIcon,
  ERC20:  Coins,
  badge:  Gift,
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  minted:  'bg-blue-100 text-blue-700',
  claimed: 'bg-emerald-100 text-emerald-700',
  failed:  'bg-red-100 text-red-700',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  minted:  'Minted',
  claimed: 'Claimed',
  failed:  'Failed',
};

// Format currency to RM
const formatRM = (amount: number): string => {
  return new Intl.NumberFormat('ms-MY', {
    style: 'currency',
    currency: 'MYR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};

// ── Credit score card (fixed layout) ─────────────────────────────────────────
function CreditScoreCard({ score }: { score: CreditScore }) {
  const pct = Math.min((score.score / 1000) * 100, 100);
  
  return (
    <Card className="overflow-hidden">
      {/* Progress bar at top */}
      <div 
        className="h-2 bg-gradient-to-r from-amber-400 via-yellow-300 to-violet-500 transition-all duration-500" 
        style={{ width: `${pct}%` }} 
      />
      
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" /> 
          Credit Score
        </CardTitle>
        <CardDescription>
          The more you contribute, the higher your score and the rarer your rewards
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Score row - fixed layout */}
        <div className="flex items-end justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-extrabold tabular-nums">{score.score}</span>
            <span className="text-muted-foreground text-xl">/ 1000</span>
          </div>
          <span className={`px-3 py-1 rounded-full border text-sm font-bold whitespace-nowrap ${LEVEL_COLORS[score.level]}`}>
            {score.level}
          </span>
        </div>
        
        {/* Progress bar */}
        <Progress value={pct} className="h-2" />
        
        {/* Stats grid - fixed alignment */}
        <div className="grid grid-cols-3 gap-3 pt-2 text-center">
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="font-bold text-xl">{formatRM(score.totalDonations)}</p>
            <p className="text-muted-foreground text-xs mt-1">Total donated</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="font-bold text-xl">{score.campaignsSupported}</p>
            <p className="text-muted-foreground text-xs mt-1">Campaigns</p>
          </div>
          <div className="bg-muted/40 rounded-lg p-3">
            <p className="font-bold text-xl">{score.streakDays}d</p>
            <p className="text-muted-foreground text-xs mt-1">Streak</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Reward card ───────────────────────────────────────────────
function RewardCard({ reward, onClaim }: { reward: Reward; onClaim: (id: string) => void }) {
  const Icon = TYPE_ICON[reward.type] ?? Gift;
  const [claiming, setClaiming] = React.useState(false);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await new Promise((r) => setTimeout(r, 1200));
      onClaim(reward.id);
      toast.success(`${reward.name} claimed!`);
    } catch (error) {
      toast.error(`Failed to claim ${reward.name}. Please try again.`);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4 }}
    >
      <Card className="hover:shadow-md transition-shadow overflow-hidden">
        <div className="flex flex-col sm:flex-row">
          {/* Image/Icon area */}
          <div className="w-full sm:w-24 h-24 sm:h-auto flex-shrink-0 bg-primary/5 flex items-center justify-center border-b sm:border-b-0 sm:border-r">
            {reward.imageUrl ? (
              <img src={reward.imageUrl} alt={reward.name} className="w-16 h-16 rounded-xl object-contain" />
            ) : (
              <Icon className="w-10 h-10 text-primary/40" />
            )}
          </div>
          
          {/* Content area */}
          <div className="flex-1 p-4 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight truncate">{reward.name}</p>
                <p className="text-xs text-muted-foreground truncate">{reward.campaignTitle}</p>
              </div>
              <span className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${STATUS_COLOR[reward.status]}`}>
                {STATUS_LABEL[reward.status]}
              </span>
            </div>
            
            <p className="text-xs text-muted-foreground line-clamp-2">{reward.description}</p>
            
            {reward.type === 'ERC20' && reward.tokenAmount && (
              <div className="flex items-center gap-1 text-xs font-semibold text-primary">
                <Coins className="w-3 h-3" /> {reward.tokenAmount} FUNDY Tokens
              </div>
            )}
            
            {reward.contractAddress && (
              <p className="text-[10px] font-mono text-muted-foreground truncate">{reward.contractAddress}</p>
            )}
            
            {reward.status === 'minted' && (
              <Button 
                size="sm" 
                className="self-start mt-1" 
                onClick={handleClaim} 
                disabled={claiming}
                aria-label={`Claim ${reward.name} reward`}
              >
                {claiming ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                Claim reward
              </Button>
            )}
            
            {reward.status === 'claimed' && (
              <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                {reward.claimedAt ? `Claimed on ${new Date(reward.claimedAt).toLocaleDateString()}` : 'Claimed'}
              </div>
            )}
            
            {reward.status === 'pending' && (
              <div className="flex items-center gap-1 text-xs text-amber-600">
                <Clock className="w-3 h-3" /> Awaiting on-chain confirmation...
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="animate-pulse">
        <div className="h-64 bg-muted rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="h-80 bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
          <div className="h-32 bg-muted rounded-xl animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// Empty rewards component
function EmptyRewardsState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
        <Gift className="w-12 h-12 mb-4 opacity-20" />
        <p className="font-medium">No rewards yet</p>
        <p className="text-sm mt-1">Make a donation to automatically earn Token or NFT rewards</p>
        <Button className="mt-4" onClick={onNavigate}>
          Explore campaigns
        </Button>
      </CardContent>
    </Card>
  );
}

// Unauthenticated state component
function UnauthenticatedState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-accent/20 p-6 rounded-full mb-6">
        <ShieldCheck className="w-16 h-16 text-primary" />
      </div>
      <h2 className="text-3xl font-bold mb-4">Sign in required</h2>
      <p className="text-muted-foreground max-w-md mb-8">
        Please log in to view and claim your donation rewards and NFTs.
      </p>
      <Button size="lg" onClick={onNavigate}>
        Sign In
      </Button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function Rewards() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { rewards, creditScore, isLoading, claimReward, pendingCount } = useRewards(user?.id);
  const { wallet, connect, disconnect, isConnecting, isConnected, shortAddress, networkName, isMetaMaskInstalled } = useWallet();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  // Unauthenticated state
  if (!isAuthenticated) {
    return <UnauthenticatedState onNavigate={() => navigate(ROUTE_PATHS.LOGIN)} />;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-extrabold tracking-tight mb-2 flex items-center gap-2">
            <Gift className="w-8 h-8 text-primary" /> 
            My Rewards & Score
          </h1>
          <p className="text-muted-foreground">
            Every donation triggers an on-chain reward. Connect your wallet to mint and claim Token / NFT rewards.
          </p>
        </div>

        {/* Wallet connect banner */}
        <Card className={`border-2 transition-colors ${
          isConnected ? 'border-emerald-200 bg-emerald-50/40' : 'border-primary/20'
        }`}>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5">
            <div className="flex-1">
              {isConnected ? (
                <>
                  <p className="font-semibold text-emerald-700 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Wallet connected
                  </p>
                  <p className="text-sm text-muted-foreground font-mono mt-0.5">
                    {shortAddress} · {networkName} · {wallet?.balance} ETH
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold">Connect your Web3 wallet</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {isMetaMaskInstalled 
                      ? 'Connect MetaMask to mint and claim on-chain rewards' 
                      : 'Please install the MetaMask browser extension first'}
                  </p>
                </>
              )}
            </div>
            
            {isConnected ? (
              <Button variant="outline" size="sm" onClick={disconnect}>
                Disconnect
              </Button>
            ) : (
              <Button 
                onClick={connect} 
                disabled={isConnecting || !isMetaMaskInstalled} 
                className="gap-2"
              >
                {isConnecting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isMetaMaskInstalled ? 'Connect MetaMask' : 'Install MetaMask'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Pending rewards notification */}
        {pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm">
            <p className="font-semibold text-amber-800 flex items-center gap-2">
              <Clock className="w-4 h-4" /> 
              {pendingCount} reward{pendingCount !== 1 ? 's' : ''} pending
            </p>
            <p className="text-amber-700 mt-1 text-xs">
              Status will update automatically once confirmed on-chain.
            </p>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Credit score sidebar */}
          <div className="lg:col-span-1 space-y-4">
            {creditScore ? (
              <CreditScoreCard score={creditScore} />
            ) : (
              <Card className="flex items-center justify-center h-64">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </Card>
            )}
          </div>

          {/* Rewards list */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">My rewards</h2>
              <Badge variant="secondary">
                {rewards.length} item{rewards.length !== 1 ? 's' : ''}
              </Badge>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : rewards.length === 0 ? (
              <EmptyRewardsState onNavigate={() => navigate(ROUTE_PATHS.CAMPAIGNS)} />
            ) : (
              rewards.map((reward) => (
                <RewardCard 
                  key={reward.id} 
                  reward={reward} 
                  onClaim={claimReward} 
                />
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}