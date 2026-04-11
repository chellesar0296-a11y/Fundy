import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCampaigns, dbCampaignToFrontend } from '@/hooks/useCampaigns';
import { supabase } from '@/lib/supabase';
import { Search, Filter, Loader2, CheckCircle2, Flame } from 'lucide-react';
import { CampaignCard } from '@/components/Cards';
import { useLanguage } from '@/hooks/useLanguage';
import { Campaign } from '@/lib/index';

const CATEGORIES: Campaign['category'][] = [
  'Medical', 'Education', 'Environment', 'Disaster', 'Community', 'Animals',
  'Personal', 'Sports',
  'Creative', 'Technology', 'Business',
];

const CATEGORY_EMOJI: Record<string, string> = {
  Medical: '🏥', Education: '📚', Environment: '🌿', Disaster: '🆘',
  Community: '🤝', Animals: '🐾', Personal: '🙋', Sports: '⚽',
  Creative: '🎨', Technology: '💻', Business: '💼',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Campaigns() {
  const { t } = useLanguage();
  const { campaigns: activeCampaigns, isLoading } = useCampaigns();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Campaign['category'] | 'All'>('All');
  const [statusTab, setStatusTab] = useState<'active' | 'completed'>('active');
  const [completedCampaigns, setCompletedCampaigns] = useState<Campaign[]>([]);
  const [completedLoading, setCompletedLoading] = useState(false);

  useEffect(() => {
    if (statusTab === 'completed' && completedCampaigns.length === 0) {
      setCompletedLoading(true);
      supabase
        .from('campaigns')
        .select('*, profiles(*)')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setCompletedCampaigns(data.map(dbCampaignToFrontend));
        })
        .catch(() => {})
        .finally(() => setCompletedLoading(false));
    }
  }, [statusTab]);

  const allCampaigns = statusTab === 'active' ? activeCampaigns : completedCampaigns;
  const currentlyLoading = statusTab === 'active' ? isLoading : completedLoading;

  const filteredCampaigns = useMemo(() => {
    return allCampaigns.filter((campaign) => {
      const matchesSearch =
        campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || campaign.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allCampaigns, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_50%,var(--primary)_0%,transparent_100%)] opacity-10" />
        <div className="container mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold mb-4">
            Explore Campaigns
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Discover causes that matter — from community fundraisers to creative projects and personal goals.
          </motion.p>
        </div>
      </section>

      {/* Sticky filter bar */}
      <section className="sticky top-16 z-30 bg-background/80 backdrop-blur-md border-y border-border py-3">
        <div className="container mx-auto px-4 space-y-3">

          {/* Status tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStatusTab('active')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                statusTab === 'active'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              <Flame className="w-3.5 h-3.5" /> Active
            </button>
            <button
              onClick={() => setStatusTab('completed')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                statusTab === 'completed'
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Past / Completed
            </button>
          </div>

          {/* Search + categories */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center">
            <div className="relative w-full md:w-72 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('campaign_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full">
              <button
                onClick={() => setActiveCategory('All')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  activeCategory === 'All'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                All
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    activeCategory === cat
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  }`}
                >
                  {CATEGORY_EMOJI[cat]} {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="container mx-auto px-4 mt-10">
        {!currentlyLoading && (
          <p className="text-sm text-muted-foreground mb-6">
            {filteredCampaigns.length === 0
              ? 'No campaigns found'
              : `${filteredCampaigns.length} campaign${filteredCampaigns.length !== 1 ? 's' : ''}`}
            {activeCategory !== 'All' && ` · ${activeCategory}`}
          </p>
        )}

        <AnimatePresence mode="wait">
          {currentlyLoading ? (
            <div className="flex justify-center py-20" key="loader">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
            </div>
          ) : filteredCampaigns.length > 0 ? (
            <motion.div
              key={`${statusTab}-${activeCategory}`}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
            >
              {filteredCampaigns.map((campaign) => (
                <motion.div key={campaign.id} variants={itemVariants}>
                  <CampaignCard campaign={campaign} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                <Filter className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-2xl font-bold mb-2">
                {statusTab === 'completed' ? 'No completed campaigns yet' : 'No campaigns found'}
              </h3>
              <p className="text-muted-foreground max-w-md text-sm">
                {statusTab === 'completed'
                  ? 'Completed campaigns will appear here once they end.'
                  : 'Try adjusting your search or filter.'}
              </p>
              <button
                onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                className="mt-6 px-6 py-2 bg-primary text-primary-foreground rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Reset Filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
