import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { createCampaign, supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ROUTE_PATHS, RewardType } from '@/lib/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ImageIcon, Loader2, ArrowLeft, Info, ShieldCheck, ShieldAlert,
  Plus, Trash2, Gift, Coins, Image as NftIcon, Package,
  ChevronDown, ChevronUp, Sparkles,
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

const REWARD_TYPE_META: Record<RewardType, { label: string; icon: React.ElementType; desc: string; color: string }> = {
  ERC20:    { label: 'Token Reward',    icon: Coins,    desc: 'Distribute fungible tokens to supporters',        color: 'text-blue-600 bg-blue-50 border-blue-200' },
  ERC721:   { label: 'NFT Collectible', icon: NftIcon,  desc: 'Mint a unique NFT collectible for each backer',   color: 'text-violet-600 bg-violet-50 border-violet-200' },
  badge:    { label: 'Badge',           icon: Gift,     desc: 'A digital badge issued automatically on-chain',   color: 'text-amber-600 bg-amber-50 border-amber-200' },
  physical: { label: 'Physical Item',   icon: Package,  desc: 'A real item you will ship to the supporter',      color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
};

// ─── Reward tier type ─────────────────────────────────────────
interface RewardTier {
  id: string;
  minAmount: number;
  type: RewardType;
  name: string;
  description: string;
  quantity: number | null;
  tokenAmount: number | null;
}

function emptyTier(defaults?: Partial<RewardTier>): RewardTier {
  return {
    id: Math.random().toString(36).slice(2),
    minAmount: 25,
    type: 'badge',
    name: '',
    description: '',
    quantity: null,
    tokenAmount: null,
    ...defaults,
  };
}

// ─── Zod schema ───────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(10, 'Title must be at least 10 characters').max(100),
  short_description: z.string().min(20, 'Short description must be at least 20 characters').max(200),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  category: z.enum(CATEGORIES),
  goal_amount: z.coerce.number().min(100, 'Minimum goal is RM 100').max(10000000),
  end_date: z.string().min(1, 'End date is required'),
  image_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().slice(0, 80);
}

// ─── Single tier editor ───────────────────────────────────────
function TierEditor({ tier, index, onUpdate, onRemove }: {
  tier: RewardTier; index: number;
  onUpdate: (t: RewardTier) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const meta = REWARD_TYPE_META[tier.type];
  const Icon = meta.icon;
  const set = <K extends keyof RewardTier>(key: K, val: RewardTier[K]) => onUpdate({ ...tier, [key]: val });

  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}
      className="border border-border rounded-2xl overflow-hidden bg-card"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={`p-2 rounded-lg border ${meta.color}`}><Icon className="w-4 h-4" /></div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{tier.name || `Reward tier ${index + 1}`}</p>
          <p className="text-xs text-muted-foreground">Donate ≥ RM{tier.minAmount} · {meta.label}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-2 space-y-4 border-t border-border bg-muted/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Minimum donation (USD)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">RM</span>
                    <Input type="number" min={1} className="pl-7 font-mono"
                      value={tier.minAmount}
                      onChange={(e) => set('minAmount', Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reward type</Label>
                  <Select value={tier.type} onValueChange={(v) => set('type', v as RewardType)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REWARD_TYPE_META) as RewardType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          <div className="flex items-center gap-2">
                            {React.createElement(REWARD_TYPE_META[t].icon, { className: 'w-3.5 h-3.5' })}
                            {REWARD_TYPE_META[t].label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reward name</Label>
                <Input
                  placeholder={
                    tier.type === 'ERC721' ? 'e.g. Pioneer Supporter NFT'
                    : tier.type === 'ERC20' ? 'e.g. FUNDY Token Reward'
                    : tier.type === 'physical' ? 'e.g. Signed Poster, T-Shirt'
                    : 'e.g. Early Bird Badge'
                  }
                  value={tier.name} onChange={(e) => set('name', e.target.value)} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reward description</Label>
                <textarea
                  className="w-full min-h-[72px] bg-background border border-input rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none resize-none"
                  placeholder="Describe what donors receive and why it's meaningful..."
                  value={tier.description} onChange={(e) => set('description', e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tier.type === 'ERC20' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Token amount to distribute</Label>
                    <Input type="number" min={1} placeholder="e.g. 100"
                      value={tier.tokenAmount ?? ''}
                      onChange={(e) => set('tokenAmount', e.target.value ? Number(e.target.value) : null)} />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs">Limited edition quantity (leave blank = unlimited)</Label>
                  <Input type="number" min={1} placeholder="e.g. 500"
                    value={tier.quantity ?? ''}
                    onChange={(e) => set('quantity', e.target.value ? Number(e.target.value) : null)} />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────
export default function CreateCampaign() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [tiers, setTiers] = useState<RewardTier[]>([
    emptyTier({ minAmount: 20, type: 'badge', name: 'Supporter Badge', description: 'A digital badge to thank you for backing this campaign.' }),
  ]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', short_description: '', description: '', category: 'Personal', goal_amount: 5000, end_date: '', image_url: '' },
  });

  const addTier = () => setTiers((p) => [...p, emptyTier()]);
  const updateTier = (id: string, updated: RewardTier) => setTiers((p) => p.map((t) => t.id === id ? updated : t));
  const removeTier = (id: string) => setTiers((p) => p.filter((t) => t.id !== id));

  if (authLoading) return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-accent/20 p-6 rounded-full mb-6"><ShieldCheck className="w-16 h-16 text-primary" /></div>
      <h2 className="text-3xl font-bold mb-4">Sign in to Start a Campaign</h2>
      <p className="text-muted-foreground max-w-md mb-8">Create a free account to launch your fundraising campaign and start making an impact.</p>
      <Button onClick={() => navigate(ROUTE_PATHS.HOME)} size="lg">Back to Home</Button>
    </div>
  );

  async function onSubmit(values: FormValues) {
    if (!user) return;
    const invalid = tiers.find((t) => !t.name.trim());
    if (invalid) { toast.error('Every reward tier needs a name.'); return; }
    setIsSubmitting(true);
    try {
      const slug = slugify(values.title) + '-' + Date.now().toString(36);
      const campaign = await createCampaign({
        title: values.title, slug,
        description: values.description,
        short_description: values.short_description,
        category: values.category,
        goal_amount: values.goal_amount,
        image_url: values.image_url || undefined,
        end_date: new Date(values.end_date).toISOString(),
        organizer_id: user.id,
      });

      // Save reward tiers to database
      if (tiers.length > 0) {
        const { error: tiersError } = await supabase
          .from('reward_tiers')
          .insert(
            tiers.map((t) => ({
              campaign_id: campaign.id,
              name: t.name,
              description: t.description,
              min_amount: t.minAmount,
              type: t.type,
              quantity: t.quantity ?? null,
              token_amount: t.tokenAmount ?? null,
            })),
          );
        if (tiersError) {
          console.error('[reward_tiers] insert error:', tiersError.message);
          // Don't block — campaign is created, tiers can be added later
        }
      }

      toast.success(`Campaign is live! ${tiers.length} reward tier${tiers.length !== 1 ? 's' : ''} configured.`);
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
                      <FormLabel>Goal amount (USD)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono font-bold">RM</span>
                          <Input type="number" min={100} className="pl-7 font-mono" {...field} />
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

              {/* ⑤ Reward Tiers */}
              <div className="bg-card border-2 border-amber-200 rounded-2xl p-6 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-500" /> ⑤ Reward tiers
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">P4</Badge>
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Set donation thresholds and the on-chain rewards donors automatically receive
                    </p>
                  </div>
                  <Badge variant="secondary">{tiers.length} tier{tiers.length !== 1 ? 's' : ''}</Badge>
                </div>

                {/* Type legend */}
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(REWARD_TYPE_META) as RewardType[]).map((t) => {
                    const m = REWARD_TYPE_META[t];
                    const Icon = m.icon;
                    return (
                      <div key={t} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium ${m.color}`}>
                        <Icon className="w-3.5 h-3.5 shrink-0" /><span>{m.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Tier list */}
                {tiers.length === 0 ? (
                  <div className="border-2 border-dashed border-muted rounded-xl py-10 text-center text-muted-foreground">
                    <Gift className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No reward tiers yet</p>
                    <p className="text-sm">Add a tier below to incentivize donors</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {[...tiers].sort((a, b) => a.minAmount - b.minAmount).map((tier, i) => (
                        <TierEditor key={tier.id} tier={tier} index={i}
                          onUpdate={(u) => updateTier(tier.id, u)}
                          onRemove={() => removeTier(tier.id)} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                <Button type="button" variant="outline" className="w-full gap-2 border-dashed border-amber-300 text-amber-700 hover:bg-amber-50" onClick={addTier}>
                  <Plus className="w-4 h-4" /> Add reward tier
                </Button>

                {/* Flow explanation */}
                <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                  <p className="font-semibold mb-1.5">📡 On-chain distribution flow</p>
                  <p>① Donor completes payment → ② Smart contract records amount → ③ Best matching tier selected</p>
                  <p>④ <strong>Badges & ERC-20</strong> are minted automatically → ⑤ <strong>ERC-721 NFTs</strong> are triggered via the Admin panel</p>
                  <p>⑥ Physical rewards are flagged as "pending shipment" and fulfilled manually</p>
                </div>
              </div>

              {/* Info */}
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
