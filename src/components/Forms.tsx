import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { motion } from 'framer-motion';
import { MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Campaign } from '@/lib/index';
import { submitDonation } from '@/lib/supabase';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';

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

const donationSchema = z.object({
  amount: z.coerce.number().min(1, { message: 'Minimum donation is $1' }),
  message: z.string().max(200).optional(),
  isAnonymous: z.boolean().default(false),
});

export function DonationForm({ campaign, onClose }: { campaign: Campaign; onClose?: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);

  // Block organizer from donating to own campaign
  const isOwnCampaign = !!user && user.id === campaign.organizer.id;

  const form = useForm<z.infer<typeof donationSchema>>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      amount: 25,
      message: '',
      isAnonymous: false,
    },
  });

  const presets = [10, 25, 50, 100];

  async function onSubmit(values: z.infer<typeof donationSchema>) {
    setIsSubmitting(true);
    try {
      await submitDonation({
        campaign_id: campaign.id,
        donor_id: user?.id,
        donor_name: values.isAnonymous ? 'Anonymous' : (user?.name ?? 'Guest'),
        amount: values.amount,
        message: values.message,
        is_anonymous: values.isAnonymous,
      });
      toast.success(t('donation_success'));
      if (onClose) onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process donation');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handlePresetClick = (amount: number) => {
    setSelectedPreset(amount);
    form.setValue('amount', amount);
  };

  if (isOwnCampaign) {
    return (
      <div className="w-full max-w-lg p-6 text-center space-y-3">
        <div className="inline-flex p-4 bg-amber-100 rounded-full">
          <span className="text-2xl">🚫</span>
        </div>
        <p className="font-semibold text-lg">You can't donate to your own campaign</p>
        <p className="text-sm text-muted-foreground">
          As the organizer of this campaign, you are not able to make donations to it.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full max-w-lg space-y-6 p-6 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl border border-border/50">
        <img
          src={campaign.image}
          alt={campaign.title}
          className="w-16 h-16 object-cover rounded-lg shrink-0"
        />
        <div>
          <h3 className="font-bold leading-tight">{campaign.title}</h3>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{campaign.category}</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-semibold">{t('btn_donate')} Amount ($)</Label>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={selectedPreset === preset ? 'default' : 'outline'}
                  className="h-12 text-lg"
                  onClick={() => handlePresetClick(preset)}
                >
                  ${preset}
                </Button>
              ))}
            </div>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
                      <Input
                        type="number"
                        className="pl-8 h-14 text-xl font-bold"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          setSelectedPreset(null);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="message"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Leave a Message (Optional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Words of encouragement..."
                    className="resize-none h-24"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isAnonymous"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border p-4 bg-muted/30">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="font-medium">
                    Donate anonymously
                  </FormLabel>
                  <p className="text-xs text-muted-foreground">
                    Your name won't be displayed publicly on the campaign page.
                  </p>
                </div>
              </FormItem>
            )}
          />

          <div className="pt-2">
            <Button
              type="submit"
              className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  <Heart className="h-5 w-5 fill-current" />
                  {t('btn_donate')}
                </span>
              )}
            </Button>
            <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-chart-2" />
              Secure 256-bit SSL encrypted payment
            </div>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}
