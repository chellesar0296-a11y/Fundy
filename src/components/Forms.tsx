import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2, Heart, ShieldCheck, Wallet, Coins } from 'lucide-react';
import { toast } from 'sonner';

import { Campaign } from '@/lib/index';
import { submitDonation } from '@/lib/supabase';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { useWeb3 } from '@/context/Web3Context';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useEffect } from 'react';
import { ethers } from 'ethers';

const donationSchema = z.object({
  amount: z.coerce.number().min(0.0001, { message: 'Minimum donation is 0.0001 ETH' }),
  message: z.string().max(200).optional(),
  isAnonymous: z.boolean().default(false),
});

type DonationValues = z.infer<typeof donationSchema>;

export function DonationForm({ campaign, onClose }: { campaign: Campaign; onClose?: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { isConnected, address, connect, donateEth, refreshBalance, provider } = useWeb3();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [balance, setBalance] = useState("0");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  useEffect(() => {
    if (!isConnected || !address || !provider) return;
    provider.getBalance(address).then((bal) => {
      setBalance(ethers.formatEther(bal));
    });
  }, [isConnected, address, provider]);

  const isOwnCampaign = !!user && user.id === campaign.organizer.id;

  const form = useForm<DonationValues>({
    resolver: zodResolver(donationSchema),
    defaultValues: { amount: 0.025, message: '', isAnonymous: false },
  });

  const presets = [0.01, 0.025, 0.05, 0.1];

  async function onSubmit(values: DonationValues) {
    if (!isConnected) {
      toast.error('Please connect your wallet first');
      return;
    }
    const amountNum = Number(values.amount);
    const balanceNum = Number(balance);

    if (amountNum <= 0) {
      toast.error("Invalid amount");
      return;
    }

    if (amountNum > balanceNum) {
      toast.error("Insufficient wallet balance");
      return;
    }

    setIsSubmitting(true);
    setTxHash(null);

    try {
      const amountEth = values.amount.toFixed(6);

      const onChainId = (campaign as any).onChainId as number | undefined;
      if (!onChainId) {
        toast.error('This campaign has not been registered on-chain yet. Please contact the organizer.');
        setIsSubmitting(false);
        return;
      }

      const receipt = await donateEth(onChainId, amountEth);

      // Save to Supabase
      await submitDonation({
        campaign_id: campaign.id,
        donor_id: user?.id,
        donor_name: values.isAnonymous ? 'Anonymous' : (user?.name ?? 'Guest'),
        amount: values.amount,
        message: values.message,
        is_anonymous: values.isAnonymous,
      });

      setTxHash(receipt?.hash ?? 'confirmed');
      await refreshBalance();
      toast.success(`Donation successful! ${amountEth} ETH contributed.`);
      if (onClose) setTimeout(onClose, 2500);

    } catch (err: any) {
      if (err?.code === 4001 || err?.message?.includes('user rejected')) {
        toast.error('Transaction cancelled.');
      } else {
        toast.error(err.message || 'Transaction failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    form.setValue('amount', amount);
  };

  // ── Wallet not connected ──────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="w-full py-10 text-center space-y-4">
        <div className="inline-flex p-4 bg-primary/10 rounded-full">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <p className="font-semibold text-lg">Connect Your Wallet</p>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Connect your MetaMask wallet to donate to this campaign.
        </p>
        <Button onClick={connect} size="lg" className="gap-2">
          <Wallet className="w-4 h-4" /> Connect MetaMask
        </Button>
      </div>
    );
  }

  // ── Own campaign block ────────────────────────────────────────
  if (isOwnCampaign) {
    return (
      <div className="w-full py-8 text-center space-y-3">
        <div className="inline-flex p-4 bg-amber-100 rounded-full text-2xl">🚫</div>
        <p className="font-semibold">You can't donate to your own campaign</p>
        <p className="text-sm text-muted-foreground">
          As the organizer, you are not able to make donations to this campaign.
        </p>
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────
  if (txHash) {
    return (
      <div className="w-full py-10 text-center space-y-4">
        <div className="inline-flex p-4 bg-emerald-100 rounded-full text-3xl">🎉</div>
        <p className="font-bold text-xl text-emerald-700">Donation Successful!</p>
        <p className="text-sm text-muted-foreground">Thank you for your support!</p>
        {txHash !== 'confirmed' && (
          <div className="bg-muted/50 rounded-lg p-3 mx-2">
            <p className="text-xs text-muted-foreground mb-1">Transaction Hash</p>
            <p className="font-mono text-xs break-all text-primary">{txHash}</p>
          </div>
        )}
      </div>
    );
  }

  const watchAmount = form.watch('amount') || 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg space-y-5 p-6 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Campaign preview */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border/50">
        <img src={campaign.image} alt={campaign.title} className="w-14 h-14 object-cover rounded-lg shrink-0" />
        <div className="min-w-0">
          <h3 className="font-bold leading-tight line-clamp-1">{campaign.title}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">{campaign.category}</p>
          <p className="text-xs font-mono text-primary mt-0.5">{address?.slice(0, 8)}...{address?.slice(-4)}</p>
        </div>
      </div>

      {/* Payment method: ETH only */}
      <div className="p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
        <span className="text-base">⟠</span>
        <span>Donations are made in ETH. You'll receive this campaign's stake tokens as reward.</span>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Amount */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Donation Amount (ETH)</Label>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((p) => (
                <Button key={p} type="button"
                  variant={selectedPreset === p ? 'default' : 'outline'}
                  className="h-11 font-semibold"
                  onClick={() => handlePresetClick(p)}
                >
                  ⟠ {p}
                </Button>
              ))}
            </div>
            <FormField control={form.control} name="amount" render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0.0001"
                      step="any"
                      className="pl-12 h-14 text-xl font-bold"
                      {...field}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const value = parseFloat(raw);
                        field.onChange(isNaN(value) ? 0 : value);
                        setSelectedPreset(null);
                      }}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <p className="text-xs text-right text-muted-foreground">Paying in ETH</p>
          </div>

          {/* Message */}
          <FormField control={form.control} name="message" render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Leave a Message (Optional)
              </FormLabel>
              <FormControl>
                <Textarea placeholder="Words of encouragement..." className="resize-none h-20" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )} />

          {/* Anonymous */}
          <FormField control={form.control} name="isAnonymous" render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-3 bg-muted/30">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div className="space-y-0.5 leading-none">
                <FormLabel className="font-medium text-sm">Donate anonymously</FormLabel>
                <p className="text-xs text-muted-foreground">Your name won't be shown publicly.</p>
              </div>
            </FormItem>
          )} />

          {/* Submit */}
          <Button type="submit" className="w-full h-14 text-base font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Confirm in MetaMask...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Heart className="h-5 w-5 fill-current" />
                Donate {watchAmount} ETH
              </span>
            )}
          </Button>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" />
            Secured by Ethereum smart contract on Ganache
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
