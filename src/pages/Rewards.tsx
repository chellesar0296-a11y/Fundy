// Rewards.tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Coins, Loader2, ArrowDownLeft, ArrowUpRight,
  Gift, RefreshCw, Wallet, TrendingUp, Lock,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useWeb3, CONTRACT_ADDRESSES, CROWDFUNDING_ABI } from '@/context/Web3Context';
import { ethers } from 'ethers';
import { ROUTE_PATHS } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// ── Types ──────────────────────────────────────────────────────
type TxType = 'earned_donation' | 'earned_extra' | 'earned_refund' | 'spent_donation';

interface FdyTx {
  type: TxType;
  fdyAmount: string;    // formatted FDY
  campaignId: string;
  txHash: string;
  blockNumber: number;
  date: Date | null;
}

const TX_META: Record<TxType, { label: string; sign: '+' | '-'; color: string; bg: string; icon: React.ElementType }> = {
  earned_donation: { label: 'Donation Reward',  sign: '+', color: 'text-emerald-600', bg: 'bg-emerald-50',  icon: ArrowDownLeft  },
  earned_extra:    { label: 'Bonus FDY Reward', sign: '+', color: 'text-blue-600',    bg: 'bg-blue-50',     icon: Gift           },
  earned_refund:   { label: 'Refund',           sign: '+', color: 'text-amber-600',   bg: 'bg-amber-50',    icon: RefreshCw      },
  spent_donation:  { label: 'Donated with FDY', sign: '-', color: 'text-rose-600',    bg: 'bg-rose-50',     icon: ArrowUpRight   },
};

// ETH ↔ RM: 1 ETH = 1000 RM  (same as rest of app)
const ETH_TO_RM = 1000;

// ── FDY History Hook ──────────────────────────────────────────
function useFdyHistory(address: string | null, provider: ethers.BrowserProvider | null) {
  const [txs, setTxs]       = useState<FdyTx[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address || !provider) { setTxs([]); return; }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.crowdfunding, CROWDFUNDING_ABI, provider);
        const iface    = new ethers.Interface(CROWDFUNDING_ABI);

        // Fetch all relevant events in parallel
        const [donationEvents, extraEvents, fdyDonationEvents, refundEvents] = await Promise.all([
          contract.queryFilter(contract.filters.DonationReceived(null, address), 0, 'latest'),
          contract.queryFilter(contract.filters.ExtraFdyAwarded(null, address),  0, 'latest'),
          contract.queryFilter(contract.filters.FdyDonation(null, address),      0, 'latest'),
          contract.queryFilter(contract.filters.FdyRefundIssued(null, address),  0, 'latest'),
        ]);

        if (cancelled) return;

        // Helper to get block date
        const dateCache: Record<number, Date | null> = {};
        const getDate = async (blockNumber: number): Promise<Date | null> => {
          if (blockNumber in dateCache) return dateCache[blockNumber];
          try {
            const block = await provider.getBlock(blockNumber);
            dateCache[blockNumber] = block ? new Date(Number(block.timestamp) * 1000) : null;
          } catch {
            dateCache[blockNumber] = null;
          }
          return dateCache[blockNumber];
        };

        // Parse all events
        const raw: FdyTx[] = [];

        for (const e of donationEvents) {
          try {
            const p = iface.parseLog(e);
            if (!p) continue;
            raw.push({
              type: 'earned_donation',
              fdyAmount: ethers.formatEther(p.args.fdyMinted),
              campaignId: p.args.campaignId.toString(),
              txHash: e.transactionHash,
              blockNumber: e.blockNumber,
              date: null,
            });
          } catch {}
        }

        for (const e of extraEvents) {
          try {
            const p = iface.parseLog(e);
            if (!p) continue;
            raw.push({
              type: 'earned_extra',
              fdyAmount: ethers.formatEther(p.args.fdyAmount),
              campaignId: p.args.campaignId.toString(),
              txHash: e.transactionHash,
              blockNumber: e.blockNumber,
              date: null,
            });
          } catch {}
        }

        for (const e of fdyDonationEvents) {
          try {
            const p = iface.parseLog(e);
            if (!p) continue;
            raw.push({
              type: 'spent_donation',
              fdyAmount: ethers.formatEther(p.args.fdyBurned),
              campaignId: p.args.campaignId.toString(),
              txHash: e.transactionHash,
              blockNumber: e.blockNumber,
              date: null,
            });
          } catch {}
        }

        for (const e of refundEvents) {
          try {
            const p = iface.parseLog(e);
            if (!p) continue;
            raw.push({
              type: 'earned_refund',
              fdyAmount: ethers.formatEther(p.args.fdyAmount),
              campaignId: p.args.campaignId.toString(),
              txHash: e.transactionHash,
              blockNumber: e.blockNumber,
              date: null,
            });
          } catch {}
        }

        // Sort by block descending, then fetch dates
        raw.sort((a, b) => b.blockNumber - a.blockNumber);
        const dated = await Promise.all(
          raw.map(async tx => ({ ...tx, date: await getDate(tx.blockNumber) }))
        );

        if (!cancelled) setTxs(dated);
      } catch (err) {
        console.error('FDY history fetch failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address, provider]);

  return { txs, loading };
}

// ── Main ──────────────────────────────────────────────────────
export default function Rewards() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isConnected, address, fdyBalance, ethBalance, connect, provider } = useWeb3();
  const { txs, loading: historyLoading } = useFdyHistory(isConnected ? address : null, provider);
  const navigate = useNavigate();

  // ── Auth gate ───────────────────────────────────────────────
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
          Please log in to view your FDY balance and transaction history.
        </p>
        <div className="flex gap-4">
          <Button onClick={() => navigate(ROUTE_PATHS.LOGIN)} size="lg">Log In</Button>
          <Button onClick={() => navigate(ROUTE_PATHS.HOME)} variant="outline" size="lg">Back to Home</Button>
        </div>
      </div>
    );
  }

  // ── Wallet not connected ────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-6">
        <div className="bg-muted/40 p-6 rounded-full inline-flex mx-auto">
          <Wallet className="w-14 h-14 text-muted-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-2">Connect your wallet</h2>
          <p className="text-muted-foreground">Your FDY balance and history live on-chain. Connect MetaMask to view them.</p>
        </div>
        <Button size="lg" onClick={connect} className="gap-2">🦊 Connect MetaMask</Button>
      </div>
    );
  }

  // ── Derived stats ───────────────────────────────────────────
  const fdyNum      = Number(fdyBalance);
  const ethNum      = Number(ethBalance);
  const ethInRm     = (ethNum * ETH_TO_RM).toFixed(2);

  const totalEarned = txs
    .filter(t => t.type !== 'spent_donation')
    .reduce((sum, t) => sum + Number(t.fdyAmount), 0);

  const totalSpent = txs
    .filter(t => t.type === 'spent_donation')
    .reduce((sum, t) => sum + Number(t.fdyAmount), 0);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 mb-1">
            <Coins className="w-8 h-8 text-primary" /> FDY Tokens
          </h1>
          <p className="text-muted-foreground text-sm">Earn FDY by donating. Spend FDY to donate again.</p>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* FDY Balance */}
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">FDY Balance</p>
              <p className="text-4xl font-extrabold text-primary">
                {fdyNum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                <span className="text-lg font-semibold ml-1 text-primary/70">FDY</span>
              </p>
              <p className="text-xs text-muted-foreground mt-2">1 ETH donated = 100 FDY earned</p>
            </CardContent>
          </Card>

          {/* ETH Balance */}
          <Card>
            <CardContent className="p-6">
              <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">ETH Balance</p>
              <div className="flex items-end gap-2">
                <p className="text-4xl font-extrabold">
                  {ethNum.toFixed(4)}
                  <span className="text-lg font-semibold ml-1 text-muted-foreground">ETH</span>
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                ≈ <span className="font-semibold text-foreground">RM{Number(ethInRm).toLocaleString()}</span>
              </p>
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
                <TrendingUp className="w-3 h-3" /> Total FDY Earned
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="py-4 text-center">
              <p className="text-2xl font-bold text-rose-500">
                -{totalSpent.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <ArrowUpRight className="w-3 h-3" /> Total FDY Spent
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="font-bold text-lg mb-4">Transaction History</h2>

          {historyLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : txs.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-16 text-center text-muted-foreground space-y-3">
                <div className="inline-flex p-4 bg-muted rounded-full">
                  <Coins className="w-8 h-8 opacity-30" />
                </div>
                <p className="font-medium">No FDY transactions yet</p>
                <p className="text-sm">Donate to a campaign to start earning FDY tokens.</p>
                <Button variant="outline" onClick={() => navigate(ROUTE_PATHS.CAMPAIGNS)}>
                  Browse Campaigns
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 divide-y">
                {txs.map((tx, i) => {
                  const meta = TX_META[tx.type];
                  const Icon = meta.icon;
                  const fdyDisplay = Number(tx.fdyAmount).toLocaleString(undefined, { maximumFractionDigits: 2 });

                  return (
                    <motion.div
                      key={`${tx.txHash}-${i}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bg}`}>
                        <Icon className={`w-4 h-4 ${meta.color}`} />
                      </div>

                      {/* Label + Campaign */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{meta.label}</p>
                        <p className="text-xs text-muted-foreground">
                          Campaign #{tx.campaignId}
                          {tx.date && (
                            <span className="ml-2">
                              · {tx.date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Amount */}
                      <div className="text-right shrink-0">
                        <p className={`font-bold text-sm ${meta.color}`}>
                          {meta.sign}{fdyDisplay} FDY
                        </p>
                        <a
                          href={`https://sepolia.etherscan.io/tx/${tx.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
                        >
                          {tx.txHash.slice(0, 8)}...
                        </a>
                      </div>
                    </motion.div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

      </motion.div>
    </div>
  );
}
