import React from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Users, TrendingUp, Heart, Zap } from 'lucide-react';
import { IMAGES } from '@/assets/images';
import { ROUTE_PATHS } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { mockStats } from '@/data/index';
import { useCampaigns } from '@/hooks/useCampaigns';
import { CampaignCard, StatsCard } from '@/components/Cards';
import { AuthModal } from '@/components/AuthModal';
import { useAuth } from '@/hooks/useAuth';

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export default function Home() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { campaigns } = useCampaigns();
  const [searchParams, setSearchParams] = useSearchParams();
  const [authModal, setAuthModal] = React.useState<{ open: boolean; tab: 'login' | 'register' }>({ open: false, tab: 'login' });

  React.useEffect(() => {
    const auth = searchParams.get('auth');
    if (auth === 'login' || auth === 'register') {
      setAuthModal({ open: true, tab: auth });
      setSearchParams({}, { replace: true });
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen overflow-hidden">
      <AuthModal isOpen={authModal.open} onClose={() => setAuthModal(s => ({ ...s, open: false }))} defaultTab={authModal.tab} />
      {/* Hero Section */}
      <section className="relative pt-20 pb-24 md:pt-32 md:pb-40">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="z-10 text-center lg:text-left"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6 border border-primary/20">
                <Zap size={16} />
                <span>{t('hero_badge', { defaultValue: 'Transforming Lives Globally' })}</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6 leading-tight text-foreground">
                {t('hero_title')}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto lg:mx-0">
                {t('hero_subtitle')}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  to={ROUTE_PATHS.CAMPAIGNS}
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25"
                >
                  {t('btn_donate')}
                  <ArrowRight className="ml-2" size={20} />
                </Link>
                <Link
                  to={ROUTE_PATHS.ABOUT}
                  className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-secondary text-secondary-foreground font-semibold text-lg transition-all hover:bg-accent border border-border"
                >
                  {t('btn_learn_more')}
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="rounded-2xl overflow-hidden aspect-[4/5] shadow-2xl transform hover:scale-[1.02] transition-transform duration-500">
                    <img src={IMAGES.HERO_COMMUNITY_2} alt="Community 1" className="w-full h-full object-cover" />
                  </div>
                  <div className="rounded-2xl overflow-hidden aspect-square shadow-xl transform translate-x-4 hover:scale-[1.02] transition-transform duration-500">
                    <img src={IMAGES.HERO_COMMUNITY_3} alt="Community 2" className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="pt-12">
                  <div className="rounded-2xl overflow-hidden aspect-[4/5] shadow-2xl transform -translate-x-4 hover:scale-[1.02] transition-transform duration-500">
                    <img src={IMAGES.HERO_COMMUNITY_4} alt="Community 3" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
              {/* Floating Stat Card */}
              <div className="absolute -bottom-6 -left-6 bg-card border border-border p-6 rounded-2xl shadow-xl hidden md:block backdrop-blur-sm bg-card/80">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Live Growth</p>
                    <p className="text-xl font-bold font-mono">+24.8%</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>


      {/* Featured Campaigns */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t('featured_title', { defaultValue: 'Featured Causes' })}</h2>
              <p className="text-muted-foreground text-lg">
                {t('featured_subtitle', { defaultValue: 'Handpicked campaigns that need your immediate support to create a lasting difference.' })}
              </p>
            </div>
            <Link
              to={ROUTE_PATHS.CAMPAIGNS}
              className="text-primary font-semibold flex items-center hover:underline group"
            >
              {t('btn_view_all')}
              <ArrowRight className="ml-1 group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
          </div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {campaigns.filter(c => !user || c.organizer.id !== user.id).slice(0, 3).map((campaign) => (
              <motion.div key={campaign.id} variants={fadeInUp}>
                <CampaignCard campaign={campaign} />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden bg-primary text-primary-foreground p-12 md:p-20 text-center"
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-[120px] translate-x-1/2 translate-y-1/2" />
          </div>
          <div className="relative z-10 max-w-3xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold mb-8 leading-tight">
              {t('cta_title', { defaultValue: 'Ready to Start Your Own Campaign?' })}
            </h2>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-10">
              {t('cta_subtitle', { defaultValue: 'Join thousands of organizers making a real difference. It only takes 5 minutes to set up.' })}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <>
                  <Link
                    to={ROUTE_PATHS.CREATE_CAMPAIGN}
                    className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-primary font-bold text-lg hover:bg-white/90 transition-colors"
                  >
                    Start a Campaign
                  </Link>
                  <Link
                    to={ROUTE_PATHS.CAMPAIGNS}
                    className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/30 bg-white/10 text-white font-bold text-lg hover:bg-white/20 transition-colors"
                  >
                    {t('btn_donate')}
                  </Link>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setAuthModal({ open: true, tab: 'register' })}
                    className="inline-flex items-center justify-center px-8 py-4 rounded-xl bg-white text-primary font-bold text-lg hover:bg-white/90 transition-colors"
                  >
                    {t('btn_register')}
                  </button>
                  <Link
                    to={ROUTE_PATHS.CAMPAIGNS}
                    className="inline-flex items-center justify-center px-8 py-4 rounded-xl border border-white/30 bg-white/10 text-white font-bold text-lg hover:bg-white/20 transition-colors"
                  >
                    {t('btn_donate')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </section>

      {/* Simple Footer Text (Layout handles main footer) */}
      <footer className="py-12 border-t border-border">
        <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
          <div className="flex flex-wrap justify-center gap-6 mb-4">
            <Link to={ROUTE_PATHS.HOME} className="hover:text-primary transition-colors">{t('nav_home')}</Link>
            <Link to={ROUTE_PATHS.CAMPAIGNS} className="hover:text-primary transition-colors">{t('nav_campaigns')}</Link>
            <Link to={ROUTE_PATHS.ABOUT} className="hover:text-primary transition-colors">{t('nav_about')}</Link>
          </div>
          <p>{t('footer_rights')}</p>
        </div>
      </footer>
    </div>
  );
}
