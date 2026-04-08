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
  AlertCircle
} from 'lucide-react';
import { Campaign, ROUTE_PATHS } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { useCampaign } from '@/hooks/useCampaigns';
import { Loader2 } from 'lucide-react';
import { ProgressBar } from '@/components/ProgressBar';
import { SocialShare } from '@/components/SocialShare';
import { DonationForm } from '@/components/Forms';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const { campaign, isLoading } = useCampaign(id ?? '');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
                      {campaign.organizer.isVerified && <CheckCircle className="w-4 h-4 text-primary" />}
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

              <div className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-xl font-medium text-muted-foreground mb-8 leading-relaxed italic">
                  "{campaign.shortDescription}"
                </p>
                <div className="space-y-6 text-foreground/80 leading-relaxed">
                  {campaign.description.split('\n').map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="bg-accent/30 rounded-2xl p-8 border border-accent/50"
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
                        onClick={() => setIsDonationOpen(true)}
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
                  </CardContent>
                </Card>
              </motion.div>

              {/* Recent Donors Peek (Mock) */}
              <Card className="border-dashed">
                <CardContent className="p-6">
                  <h4 className="font-bold mb-4">Recent Support</h4>
                  <div className="space-y-4">
                    {[1, 2, 3].map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          D{i + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold">Anonymous Donor</p>
                          <p className="text-xs text-muted-foreground">Donated RM50 • 2h ago</p>
                        </div>
                      </div>
                    ))}
                  </div>
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
    </div>
  );
}
