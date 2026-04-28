import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Coins, Loader2, ArrowDownLeft, ArrowUpRight,
  Gift, RefreshCw, Wallet, TrendingUp, BarChart3,
  Copy, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useWeb3, CONTRACT_ADDRESSES, CROWDFUNDING_ABI } from '@/context/Web3Context';
import { ethers } from 'ethers';
import { supabase } from '@/lib/supabase';
import { ROUTE_PATHS } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────
type TxType = 'auto_reward' | 'extra_reward' | 'transferred_out' | 'transferred_in';

interface HistoryTx {
  type: TxType;
  amount: number;
  amountDisplay: string;
  campaignId: number;
  campaignTitle: string;
  tokenSymbol: string;
  txHash?: string;
  date: Date;
}

const TX_META: Record<TxType, { label: string; sign: '+' | '-'; color: string; bg: string; icon: React.ElementType }> = {
  auto_reward:     { label: 'Auto Stake Reward', sign: '+', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: Gift },
  extra_reward:    { label: 'Bonus Stake Reward', sign: '+', color: 'text-blue-600',    bg: 'bg-blue-50',   icon: Gift },
  transferred_out: { label: 'Transferred Out',    sign: '-', color: 'text-rose-600',   bg: 'bg-rose-50',    icon: ArrowUpRight },
  transferred_in:  { label: 'Received',           sign: '+', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ArrowDownLeft },
};

interface StakePosition {
  campaignId: number;
  campaignTitle: string;
  tokenSymbol: string;
  tokenAddress: string;
  balance: number;
  totalSupply: number;
  stakePct: string;
}


async function addTokenToMetaMask(tokenAddress: string, tokenSymbol: string, decimals: number = 18) {
  if (!window.ethereum) {
    toast.error('MetaMask not detected. Please install MetaMask first.');
    return false;
  }
  try {
    await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: tokenAddress,
          symbol: tokenSymbol,
          decimals: decimals,
        },
      },
    });
    toast.success(`${tokenSymbol} added to MetaMask!`);
    return true;
  } catch (err: any) {
    if (err.code === 4001) {
      toast.error('User rejected the request.');
    } else {
      toast.error('Failed to add token to MetaMask');
    }
    return false;
  }
}

// ── useMyStakes hook ──────────────────────────────────────────
function useMyStakes(address: string | null, provider: ethers.BrowserProvider | null) {
  const [stakes, setStakes] = useState<StakePosition[]>([]);
  const [totalFdy, setTotalFdy] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !provider) { setStakes([]); setTotalFdy(0); return; }
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, provider);
        const count = Number(await contract.campaignCount());

        const ERC20_ABI = [
          'function balanceOf(address) view returns (uint256)',
          'function totalSupply() view returns (uint256)',
          'function symbol() view returns (string)',
        ];

        const positions: StakePosition[] = [];
        let totalRaw = 0n;

        let nameMap: Record<number, string> = {};
        try {
          const ids = Array.from({ length: count }, (_, i) => i + 1);
          const { data } = await supabase.from('campaigns').select('on_chain_id, title').in('on_chain_id', ids);
          if (data) nameMap = data.reduce((acc: any, c: any) => { acc[c.on_chain_id] = c.title; return acc; }, {});
        } catch {}

        for (let i = 1; i <= count; i++) {
          try {
            const c = await contract.getCampaign(i);
            if (!c.stakeToken || c.stakeToken === ethers.ZeroAddress) continue;

            const token = new ethers.Contract(c.stakeToken, ERC20_ABI, provider);
            const [bal, supply] = await Promise.all([token.balanceOf(address), token.totalSupply()]);
            if (bal === 0n) continue;

            const balNum = Number(ethers.formatEther(bal));
            const supplyNum = Number(ethers.formatEther(supply));
            totalRaw += bal;

            positions.push({
              campaignId:    i,
              campaignTitle: nameMap[i] || `Campaign #${i}`,
              tokenSymbol:   c.tokenSymbol || 'FDY',
              tokenAddress:  c.stakeToken,
              balance:       balNum,
              totalSupply:   supplyNum,
              stakePct:      supplyNum > 0 ? ((balNum / supplyNum) * 100).toFixed(2) : '0.00',
            });
          } catch {}
        }

        positions.sort((a, b) => b.balance - a.balance);
        if (!cancelled) {
          setStakes(positions);
          setTotalFdy(Number(ethers.formatEther(totalRaw)));
        }
      } catch (e) {
        console.error('[useMyStakes]', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, provider]);

  return { stakes, totalFdy, loading };
}

// ── History Hook - reads on-chain FundsWithdrawn + ERC20 Transfer events ──
function useDonationHistory(
  address: string | null,
  provider: ethers.BrowserProvider | null,
  stakes: StakePosition[],
) {
  const [history, setHistory] = useState<HistoryTx[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !provider || stakes.length === 0) {
      setHistory([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const entries: HistoryTx[] = [];

        const ERC20_ABI = [
          'event Transfer(address indexed from, address indexed to, uint256 value)',
          'function symbol() view returns (string)',
        ];
        const ZERO = ethers.ZeroAddress;

        const cfContract = new ethers.Contract(
          CONTRACT_ADDRESSES.crowdfunding,
          CROWDFUNDING_ABI,
          provider,
        );

        for (const stake of stakes) {
          const token = new ethers.Contract(stake.tokenAddress, ERC20_ABI, provider);

          // ── 1. Minted-to-user (auto + extra) via Transfer(0x0 → user) ──
          const mintFilter = token.filters.Transfer(ZERO, address);
          const mintLogs = await token.queryFilter(mintFilter, 0, 'latest');

          for (const log of mintLogs) {
            const parsed = log as ethers.EventLog;
            const amount = Number(ethers.formatEther(parsed.args.value));
            const block = await parsed.getBlock();
            const date = new Date(block!.timestamp * 1000);
            const txHash = parsed.transactionHash;

            // Check corresponding FundsWithdrawn to split auto vs extra
            let isExtra = false;
            const receipt = await provider.getTransactionReceipt(txHash);
            if (receipt) {
              const iface = new ethers.Interface(CROWDFUNDING_ABI);
              for (const rlog of receipt.logs) {
                try {
                  const p = iface.parseLog({ topics: [...rlog.topics], data: rlog.data });
                  if (p?.name === 'FundsWithdrawn' && Number(p.args.campaignId) === stake.campaignId) {
                    const extraMinted = Number(ethers.formatEther(p.args.extraTokensMinted));
                    if (extraMinted > 0 && Math.abs(amount - extraMinted) < 0.01) {
                      isExtra = true;
                    }
                    break;
                  }
                } catch {}
              }
            }

            entries.push({
              type: isExtra ? 'extra_reward' : 'auto_reward',
              amount,
              amountDisplay: amount.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              campaignId: stake.campaignId,
              campaignTitle: stake.campaignTitle,
              tokenSymbol: stake.tokenSymbol,
              txHash,
              date,
            });
          }

          // ── 2. Transferred OUT by user (Transfer(user → non-zero)) ──
          const outFilter = token.filters.Transfer(address, null);
          const outLogs = await token.queryFilter(outFilter, 0, 'latest');
          for (const log of outLogs) {
            const parsed = log as ethers.EventLog;
            if (parsed.args.to === ZERO) continue;
            const amount = Number(ethers.formatEther(parsed.args.value));
            const block = await parsed.getBlock();
            entries.push({
              type: 'transferred_out',
              amount,
              amountDisplay: amount.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              campaignId: stake.campaignId,
              campaignTitle: stake.campaignTitle,
              tokenSymbol: stake.tokenSymbol,
              txHash: parsed.transactionHash,
              date: new Date(block!.timestamp * 1000),
            });
          }

          // ── 3. Received FROM another address (Transfer(non-zero → user, non-mint)) ──
          const inFilter = token.filters.Transfer(null, address);
          const inLogs = await token.queryFilter(inFilter, 0, 'latest');
          for (const log of inLogs) {
            const parsed = log as ethers.EventLog;
            if (parsed.args.from === ZERO) continue;
            const amount = Number(ethers.formatEther(parsed.args.value));
            const block = await parsed.getBlock();
            entries.push({
              type: 'transferred_in',
              amount,
              amountDisplay: amount.toLocaleString(undefined, { maximumFractionDigits: 2 }),
              campaignId: stake.campaignId,
              campaignTitle: stake.campaignTitle,
              tokenSymbol: stake.tokenSymbol,
              txHash: parsed.transactionHash,
              date: new Date(block!.timestamp * 1000),
            });
          }
        }

        entries.sort((a, b) => b.date.getTime() - a.date.getTime());
        if (!cancelled) setHistory(entries);
      } catch (err) {
        console.error('[useDonationHistory]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, provider, stakes]);

  return { history, loading };
}

// ── Main ──────────────────────────────────────────────────────
export default function Rewards() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isConnected, address, ethBalance, connect, provider } = useWeb3();
  const { stakes, totalFdy, loading: stakesLoading } = useMyStakes(isConnected ? address : null, provider);
  const { history, loading: historyLoading } = useDonationHistory(isConnected ? address : null, provider, stakes);
  const navigate = useNavigate();

  // Auth gate
  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-primary/10 p-6 rounded-full mb-6">
          <Coins className="w-16 h-16 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Authentication Required</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Please log in to view your stake tokens and transaction history.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate(ROUTE_PATHS.LOGIN)} size="lg">Log In</Button>
          <Button onClick={() => navigate(ROUTE_PATHS.HOME)} variant="outline" size="lg">Back to Home</Button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
        <div className="bg-muted/40 p-6 rounded-full inline-flex mx-auto">
          <Wallet className="w-14 h-14 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
          <p className="text-muted-foreground">Your stake tokens live on-chain. Connect MetaMask to view them.</p>
        </div>
        <Button size="lg" onClick={connect} className="gap-2">🦊 Connect MetaMask</Button>
      </div>
    );
  }

  const ethNum = Number(ethBalance);

  const totalEarned = history
    .filter(t => t.type === 'auto_reward' || t.type === 'extra_reward' || t.type === 'transferred_in')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalTransferred = history
    .filter(t => t.type === 'transferred_out')
    .reduce((sum, t) => sum + t.amount, 0);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 mb-1">
            <Coins className="w-8 h-8 text-primary" /> My Stake Tokens
          </h1>
          <p className="text-muted-foreground text-sm">Each campaign issues its own stake token (FDY-XXXX), earned by donating.</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Stake Tokens Held</p>
              {stakesLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary mt-2" />
              ) : (
                <p className="text-4xl font-extrabold text-primary">
                  {totalFdy.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  <span className="text-lg font-semibold ml-1 text-primary/70">tokens</span>
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">Across {stakes.length} campaign{stakes.length !== 1 ? 's' : ''} · 1 ETH donated = 100 tokens</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">ETH Balance</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-extrabold">
                  {ethNum.toFixed(4)}
                  <span className="text-lg font-semibold ml-1 text-muted-foreground">ETH</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-emerald-600">
                +{totalEarned.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <TrendingUp className="w-3 h-3" /> Total Tokens Received
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-rose-500">
                -{totalTransferred.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Total Transferred Out
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="stakes">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history" className="gap-2">
              <TrendingUp className="w-4 h-4" /> History
            </TabsTrigger>
            <TabsTrigger value="stakes" className="gap-2">
              <BarChart3 className="w-4 h-4" /> My Stakes
            </TabsTrigger>
          </TabsList>

          {/* History Tab */}
          <TabsContent value="history" className="mt-4">
            {(historyLoading || stakesLoading) ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center text-muted-foreground space-y-3">
                  <div className="inline-flex p-4 bg-muted rounded-full">
                    <Coins className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="font-medium">No token activity yet</p>
                  <p className="text-sm">
                    {stakes.length === 0
                      ? 'Donate to a campaign to start earning stake tokens.'
                      : 'Stake tokens are minted when campaign funds are withdrawn. Check back after the organizer withdraws.'}
                  </p>
                  <Button variant="outline" onClick={() => navigate(ROUTE_PATHS.CAMPAIGNS)}>
                    Browse Campaigns
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0 divide-y">
                  {history.map((tx, i) => {
                    const meta = TX_META[tx.type];
                    const Icon = meta.icon;

                    return (
                      <motion.div
                        key={`${tx.campaignId}-${i}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                          <Icon className={`w-4 h-4 ${meta.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {tx.campaignTitle}
                            <span className="ml-2">
                              · {tx.date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`font-bold text-sm ${meta.color}`}>
                            {meta.sign}{tx.amountDisplay} {tx.tokenSymbol}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="stakes" className="mt-4">
            {stakesLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : stakes.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-16 text-center text-muted-foreground space-y-3">
                  <div className="inline-flex p-4 bg-muted rounded-full">
                    <BarChart3 className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="font-medium">No stake positions yet</p>
                  <p className="text-sm">Stake tokens are minted when a campaign you've supported successfully withdraws funds.</p>
                  <Button variant="outline" onClick={() => navigate(ROUTE_PATHS.CAMPAIGNS)}>
                    Browse Campaigns
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {stakes.map((s, i) => (
                  <motion.div
                    key={s.tokenAddress}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className="bg-primary/10 text-primary font-mono text-xs border-primary/20">
                                {s.tokenSymbol}
                              </Badge>
                              <p className="font-semibold text-sm truncate">{s.campaignTitle}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {s.tokenAddress.slice(0, 10)}...{s.tokenAddress.slice(-8)}
                              </p>
                              <button
                                onClick={() => copyToClipboard(s.tokenAddress, 'Contract address')}
                                className="text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-xl text-primary">
                              {s.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">{s.stakePct}% of supply</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                            <span>Your stake</span>
                            <span>Total supply: {s.totalSupply.toLocaleString(undefined, { maximumFractionDigits: 2 })} {s.tokenSymbol}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${Math.min(100, parseFloat(s.stakePct))}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-8 flex-1 gap-1"
                            onClick={() => copyToClipboard(s.tokenAddress, 'Contract address')}
                          >
                            <Copy className="w-3 h-3" /> Copy Contract
                          </Button>
                          <Button
                            size="sm"
                            className="text-xs h-8 flex-1 gap-1 bg-primary hover:bg-primary/90"
                            onClick={() => addTokenToMetaMask(s.tokenAddress, s.tokenSymbol, 18)}
                          >
                            🦊 Add to MetaMask
                          </Button>
                        </div>

                        <p className="text-[10px] text-muted-foreground text-center mt-3">
                          💡 After adding, transfer via MetaMask using <strong>{s.tokenSymbol}</strong>
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

      </motion.div>
    </div>
  );
}