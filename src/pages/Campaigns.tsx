import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Search, Filter, SlidersHorizontal, LayoutGrid, Loader2 } from 'lucide-react';
import { CampaignCard } from '@/components/Cards';
import { useLanguage } from '@/hooks/useLanguage';
import { Campaign } from '@/lib/index';

const CATEGORIES: Campaign['category'][] = ['Medical', 'Education', 'Environment', 'Disaster', 'Community'];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function Campaigns() {
  const { t } = useLanguage();
  const { campaigns, isLoading } = useCampaigns();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<Campaign['category'] | 'All'>('All');

  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((campaign) => {
      const matchesSearch = 
        campaign.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        campaign.shortDescription.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = activeCategory === 'All' || campaign.category === activeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [campaigns, searchQuery, activeCategory]);

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_40%_at_50%_50%,var(--primary)_0%,transparent_100%)] opacity-10" />
        <div className="container mx-auto px-4 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold mb-4"
          >
            {t('btn_view_all')}
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground text-lg max-w-2xl mx-auto"
          >
            Explore causes that matter. Every contribution brings us one step closer to a better world.
          </motion.p>
        </div>
      </section>

      {/* Search and Filter Bar */}
      <section className="sticky top-16 z-30 bg-background/80 backdrop-blur-md border-y border-border py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t('campaign_search_placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-full border border-border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Desktop Categories */}
            <div className="hidden md:flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setActiveCategory('All')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  activeCategory === 'All'
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'bg-secondary text-secondary-foreground hover:bg-accent'
                }`}
              >
                {t('campaign_filter_all')}
              </button>
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                    activeCategory === category
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-secondary text-secondary-foreground hover:bg-accent'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Mobile Filter Toggle / View Type */}
            <div className="flex items-center gap-4 w-full md:w-auto justify-between">
               <div className="flex md:hidden items-center gap-2 overflow-x-auto no-scrollbar w-full">
                  <button
                    onClick={() => setActiveCategory('All')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                      activeCategory === 'All' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                    }`}
                  >
                    {t('campaign_filter_all')}
                  </button>
                  {CATEGORIES.map(category => (
                    <button
                      key={category}
                      onClick={() => setActiveCategory(category)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        activeCategory === category ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
               </div>
               <div className="hidden md:flex items-center gap-2 text-muted-foreground">
                  <LayoutGrid className="w-5 h-5" />
                  <SlidersHorizontal className="w-5 h-5 cursor-pointer hover:text-foreground transition-colors" />
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Campaigns Grid */}
      <section className="container mx-auto px-4 mt-12">
        <AnimatePresence mode="wait">
          {isLoading ? (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : filteredCampaigns.length > 0 ? (
            <motion.div
              key="grid"
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
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-6">
                <Filter className="w-10 h-10 text-muted-foreground/50" />
              </div>
              <h3 className="text-2xl font-bold mb-2">No campaigns found</h3>
              <p className="text-muted-foreground max-w-md">
                We couldn't find any campaigns matching your current search or filter criteria. Try adjusting your settings.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setActiveCategory('All');
                }}
                className="mt-8 px-6 py-2 bg-primary text-primary-foreground rounded-full font-semibold hover:opacity-90 transition-opacity"
              >
                Reset All Filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Load More Mockup */}
      {filteredCampaigns.length > 0 && (
        <div className="container mx-auto px-4 mt-16 text-center">
          <button className="px-8 py-3 rounded-full border border-border font-semibold hover:bg-accent transition-colors">
            Load More Campaigns
          </button>
        </div>
      )}
    </div>
  );
}
