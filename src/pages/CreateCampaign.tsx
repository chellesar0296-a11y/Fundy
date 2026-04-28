import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { createCampaign, supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { useWeb3 } from '@/context/Web3Context';
import { useAuth } from '@/hooks/useAuth';
import { ROUTE_PATHS } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ImageIcon, Loader2, ArrowLeft, Info, ShieldCheck, ShieldAlert, Sparkles,
} from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────
const CATEGORIES = [
  // Charitable / cause-based
  'Medical', 'Education', 'Environment', 'Disaster', 'Community', 'Animals',
  // Personal / private fundraising
  'Personal', 'Sports',
  // Creative & innovation
  'Creative', 'Technology', 'Business',
] as const;

// ─── Zod schema ───────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(100),
  short_description: z.string().min(20, 'Short description must be at least 20 characters').max(200),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  category: z.enum(CATEGORIES),
  goal_amount: z.coerce.number().min(0.001, 'Minimum goal is 0.001 ETH').max(1000),
  end_date: z.string().min(1, 'End date is required'),
  image_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().slice(0, 80);
}

// ─── Main page ────────────────────────────────────────────────
export default function CreateCampaign() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isConnected, connect, createCampaignOnChain } = useWeb3();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');

  // ── Extra reward config (new: quantity/minDonate/fdyAmount) ──
  const [extraQuantity, setExtraQuantity]     = useState('');   // max 99
  const [extraMinDonate, setExtraMinDonate]   = useState('');   // min ETH (≥1)
  const [extraFdyAmount, setExtraFdyAmount]   = useState('');   // tokens per donor
  const [showRewardConfig, setShowRewardConfig] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', short_description: '', description: '', category: 'Personal', goal_amount: 10, end_date: '', image_url: '' },
  });

  if (authLoading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-accent/20 p-6 rounded-full mb-6"><ShieldCheck className="w-16 h-16 text-primary" /></div>
      <h2 className="text-3xl font-bold mb-4">Sign in to Start a Campaign</h2>
      <p className="text-muted-foreground max-w-md mb-8">Create a free account to launch your fundraising campaign.</p>
      <Button onClick={() => navigate(ROUTE_PATHS.HOME)} size="lg">Back to Home</Button>
    </div>
  );

  async function onSubmit(values: FormValues) {
    if (!user) return;
    if (!isConnected) { toast.error('Please connect your MetaMask wallet first.'); return; }
    setIsSubmitting(true);

    // fetch helper
    const dbFetch = (path: string, method: string, body?: object) =>
      fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Prefer': 'return=representation',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });

    try {
      const slug = slugify(values.title) + '-' + Date.now().toString(36);

      // create campaign
      const res = await dbFetch('campaigns', 'POST', {
        title: values.title, slug,
        description: values.description,
        short_description: values.short_description,
        category: values.category,
        goal_amount: values.goal_amount,
        image_url: values.image_url || undefined,
        end_date: new Date(values.end_date).toISOString(),
        organizer_id: user.id,
      });
      if (!res.ok) throw new Error('Failed to create campaign');
      const [campaign] = await res.json();

      // Extra reward validation
      const hasExtra = !!(extraQuantity && extraFdyAmount && extraMinDonate);
      if (hasExtra) {
        const q = Number(extraQuantity);
        const min = Number(extraMinDonate);
        const fdy = Number(extraFdyAmount);
        if (q < 1 || q > 99) { toast.error('Extra reward quantity must be 1–99'); setIsSubmitting(false); return; }
        if (min < 1) { toast.error('Minimum donation must be at least 1 ETH'); setIsSubmitting(false); return; }
        if (fdy < 1 || fdy > 10000) { toast.error('Extra FDY amount must be 1–10,000'); setIsSubmitting(false); return; }
      }

      // Register into the chain
      let onChainId: number | null = null;
      try {
        toast.info('Confirm in MetaMask...');
        const goalEth   = values.goal_amount.toFixed(6);
        const deadlineTs = Math.floor(new Date(values.end_date).getTime() / 1000);

        // New signature: createCampaignOnChain(supabaseId, goalEth, deadlineTs, title, extraQuantity, extraFdyAmount, extraMinDonate)
        onChainId = await createCampaignOnChain(
          campaign.id,
          goalEth,
          deadlineTs,
          values.title,
          hasExtra ? String(extraQuantity) : '0',
          hasExtra ? String(extraFdyAmount) : '0',
          hasExtra ? String(extraMinDonate) : '0',
        );

        // update on_chain_id
        await dbFetch(`campaigns?id=eq.${campaign.id}`, 'PATCH', { on_chain_id: onChainId });
        toast.success(`Campaign live on-chain! ID: #${onChainId}`);
      } catch (chainErr: any) {
        // if the update on chain is failed, delete the Supabase records
        await dbFetch(`campaigns?id=eq.${campaign.id}`, 'DELETE');
        if (chainErr?.code === 4001) {
          toast.error('Transaction cancelled. Campaign was not created.');
        } else {
          toast.error('On-chain registration failed. Please try again.');
        }
        setIsSubmitting(false);
        return;
      }

      navigate(ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', campaign.id));
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create campaign');
    } finally {
      setIsSubmitting(false);
    }
  }
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 7);
  const minDateStr = minDate.toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="bg-muted/30 border-b sticky top-0 z-10 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <h1 className="text-base font-bold">Start a Campaign</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-10 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-10">
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">New Campaign</Badge>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Create your fundraiser</h2>
            <p className="text-muted-foreground text-lg max-w-2xl">
              Tell the world about your cause — and set up on-chain rewards to automatically thank every donor.
            </p>

            {/* Wallet connection banner */}
            {!isConnected && (
              <div className="mt-4 flex items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🦊</span>
                  <div>
                    <p className="font-semibold text-sm text-amber-900">MetaMask required</p>
                    <p className="text-xs text-amber-700 mt-0.5">Connect your wallet to register your campaign on the blockchain.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 border-amber-300" onClick={connect}>
                  Connect Wallet
                </Button>
              </div>
            )}

            {user && !user.isVerified && (
              <div className="mt-4 flex items-center justify-between gap-4 p-4 bg-primary/5 border border-primary/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Verified organizers raise 3× more</p>
                    <p className="text-xs text-muted-foreground mt-0.5">A verified badge on your campaign builds donor confidence and increases contributions.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate('/verify')}>
                  Get Verified
                </Button>
              </div>
            )}
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* ① Basics */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h3 className="font-bold text-lg">① Campaign basics</h3>
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Campaign title</FormLabel>
                    <FormControl><Input placeholder="e.g. Help rebuild the community library" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="category" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="short_description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short description <span className="text-muted-foreground text-xs">(shown on campaign cards)</span></FormLabel>
                    <FormControl><Input placeholder="One sentence that captures your mission..." {...field} /></FormControl>
                    <div className="text-xs text-muted-foreground text-right">{field.value.length}/200</div>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ② Story */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h3 className="font-bold text-lg">② Your story</h3>
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full description</FormLabel>
                    <FormControl>
                      <textarea
                        className="w-full min-h-[180px] bg-background border border-input rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-y"
                        placeholder="Describe your cause in detail. Who will benefit? How will the funds be used? Why does this matter?"
                        {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* ③ Goal & Date */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h3 className="font-bold text-lg">③ Fundraising goal</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField control={form.control} name="goal_amount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal amount (ETH)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">⟠</span>
                          <Input type="number" min={0.001} step={0.001} className="pl-7 font-mono" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="end_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Campaign end date</FormLabel>
                      <FormControl><Input type="date" min={minDateStr} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* ④ Image */}
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h3 className="font-bold text-lg">④ Campaign image</h3>
                <FormField control={form.control} name="image_url" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL <span className="text-muted-foreground text-xs">(optional — paste a direct image link)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="https://images.unsplash.com/..."
                        {...field}
                        onChange={(e) => { field.onChange(e); setPreviewUrl(e.target.value); }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="w-full aspect-video rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" onError={() => setPreviewUrl('')} />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ImageIcon className="w-8 h-8" /><span className="text-sm">Image preview</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ⑤ On-chain Rewards */}
              <div className="bg-card border-2 border-amber-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" /> ⑤ On-chain Rewards
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Configure optional rewards for donors. All rewards are handled on-chain automatically.
                    </p>
                  </div>
                  <button type="button" onClick={() => setShowRewardConfig(v => !v)}
                    className="text-xs text-primary font-semibold hover:underline">
                    {showRewardConfig ? 'Hide' : 'Configure'}
                  </button>
                </div>

                {/* Always-on: FDY base reward explanation */}
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm space-y-1">
                  <p className="font-semibold text-blue-800 flex items-center gap-2">
                    🪙 Automatic Stake Token Reward <span className="text-xs font-normal">(always active)</span>
                  </p>
                  <p className="text-blue-700 text-xs">
                    Every donor automatically receives this campaign's stake token (FDY-XXXX): <strong>1 ETH donated = 100 tokens</strong>.
                    Tokens are minted at withdrawal and are freely transferable — tradeable on any platform.
                  </p>
                </div>

                {showRewardConfig && (
                  <div className="space-y-5">
                    {/* Extra reward */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                      <p className="font-semibold text-amber-900 flex items-center gap-2">
                        🎁 Extra Stake Token Reward <span className="text-xs font-normal text-amber-700">(optional)</span>
                      </p>
                      <p className="text-xs text-amber-800">
                        The first qualifying donors get bonus stake tokens, minted automatically when you withdraw.
                        The ETH cost is deducted from your payout (cost = slots × tokens ÷ 100).
                        Each donor can only receive this once.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-amber-900">
                            Number of slots <span className="font-normal text-amber-600">(max 99)</span>
                          </label>
                          <input type="number" min="1" max="99" placeholder="e.g. 20"
                            value={extraQuantity} onChange={e => setExtraQuantity(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                          <p className="text-[10px] text-amber-700">Max donors who get extra tokens</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-amber-900">
                            Min donation (ETH) <span className="font-normal text-amber-600">(≥ 1 ETH)</span>
                          </label>
                          <input type="number" min="1" step="0.1" placeholder="e.g. 5"
                            value={extraMinDonate} onChange={e => setExtraMinDonate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                          <p className="text-[10px] text-amber-700">Minimum ETH to qualify</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-amber-900">
                            Tokens per donor <span className="font-normal text-amber-600">(max 10,000)</span>
                          </label>
                          <input type="number" min="1" max="10000" placeholder="e.g. 200"
                            value={extraFdyAmount} onChange={e => setExtraFdyAmount(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
                          <p className="text-[10px] text-amber-700">Stake tokens per qualifying donor</p>
                        </div>
                      </div>
                      {extraQuantity && extraFdyAmount && extraMinDonate && (
                        <div className="p-3 bg-amber-100 rounded-lg text-xs text-amber-900">
                          <strong>Estimated cost:</strong> {Number(extraQuantity)} slots × {Number(extraFdyAmount)} tokens ÷ 100 = <strong>{((Number(extraQuantity) * Number(extraFdyAmount)) / 100).toFixed(4)} ETH</strong> deducted from your withdrawal.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}              {/* Info */}
              <div className="flex gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  Your campaign goes live immediately after submission. Donors are automatically notified when a reward is issued. Fundy charges 0% platform fees — 100% goes to your cause.
                </p>
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={isSubmitting}>Cancel</Button>
                <Button type="submit" size="lg" className="px-10 font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Publishing...</> : <>🚀 Launch Campaign</>}
                </Button>
              </div>
            </form>
          </Form>
        </motion.div>
      </div>
    </div>
  );
}
