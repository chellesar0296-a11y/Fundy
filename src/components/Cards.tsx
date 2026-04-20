import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  Target, 
  Quote, 
  TrendingUp, 
  ArrowRight, 
  Heart, 
  CheckCircle2
} from 'lucide-react';
import { Campaign, ROUTE_PATHS } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CampaignCardProps {
  campaign: Campaign;
}

export function CampaignCard({ campaign }: CampaignCardProps) {
  const { t } = useLanguage();
  const progress = Math.min(Math.round((campaign.currentAmount / campaign.goalAmount) * 100), 100);
  
  const daysLeft = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)));

  const categoryColors: Record<Campaign['category'], string> = {
    Medical: 'bg-rose-500/10 text-rose-600 border-rose-200',
    Education: 'bg-blue-500/10 text-blue-600 border-blue-200',
    Environment: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    Disaster: 'bg-orange-500/10 text-orange-600 border-orange-200',
    Community: 'bg-indigo-500/10 text-indigo-600 border-indigo-200',
  };

  return (
    <motion.div
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="h-full"
    >
      <Card className="overflow-hidden h-full flex flex-col border-border/50 bg-card hover:shadow-xl transition-shadow duration-300">
        <div className="relative aspect-video overflow-hidden">
          <img 
            src={campaign.image} 
            alt={campaign.title} 
            className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
          />
          <div className="absolute top-3 left-3 flex gap-2">
            <Badge className={cn("font-semibold border", categoryColors[campaign.category])}>
              {campaign.category}
            </Badge>
          </div>
          <button className="absolute top-3 right-3 p-2 bg-white/20 backdrop-blur-md rounded-full hover:bg-white/40 transition-colors text-white">
            <Heart className="w-4 h-4" />
          </button>
        </div>

        <CardHeader className="p-5 pb-2">
          <div className="flex items-center gap-2 mb-2">
            <Avatar className="w-6 h-6">
              <AvatarImage src={campaign.organizer.avatar} />
              <AvatarFallback>{campaign.organizer.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground font-medium">
              {t('label_organizer')} <span className="text-foreground">{campaign.organizer.name}</span>
              {campaign.organizer.isVerified && <CheckCircle2 className="inline-block w-3 h-3 ml-1 text-primary" />}
            </span>
          </div>
          <Link 
            to={ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', campaign.id)} 
            className="hover:text-primary transition-colors"
          >
            <h3 className="text-xl font-bold leading-tight line-clamp-2">{campaign.title}</h3>
          </Link>
        </CardHeader>

        <CardContent className="p-5 pt-0 flex-grow">
          <p className="text-sm text-muted-foreground line-clamp-2 mb-6">
            {campaign.shortDescription}
          </p>

          <div className="space-y-3">
            <div className="flex justify-between items-end mb-1">
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{t('label_raised')}</span>
                <span className="text-lg font-mono font-bold text-primary">RM {campaign.currentAmount.toLocaleString()}</span>
              </div>
              <span className="text-sm font-bold text-primary">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                whileInView={{ width: `${progress}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full bg-primary"
              />
            </div>
            <div className="flex justify-between text-xs font-medium">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Target className="w-3 h-3" />
                <span>{t('label_goal')}: <span className="font-mono font-semibold text-foreground">RM {campaign.goalAmount.toLocaleString()}</span></span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>{daysLeft} {t('label_days_left')}</span>
              </div>
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-5 pt-0 grid grid-cols-2 gap-3">
          <Button asChild variant="outline" className="w-full rounded-xl">
            <Link to={ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', campaign.id)}>
              {t('btn_learn_more')}
            </Link>
          </Button>
          <Button asChild className="w-full rounded-xl shadow-lg shadow-primary/20">
            <Link to={ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', campaign.id)}>
              {t('btn_donate')}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

interface TestimonialCardProps {
  testimonial: {
    id: string;
    name: string;
    role: string;
    content: string;
    avatar: string;
    rating: number;
  };
}

export function TestimonialCard({ testimonial }: TestimonialCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <Card className="h-full bg-card border-border/40 shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="p-8">
          <div className="mb-6 text-primary/20">
            <Quote className="w-12 h-12 fill-current" />
          </div>
          <p className="text-lg italic text-foreground/80 leading-relaxed mb-8">
            "{testimonial.content}"
          </p>
          <div className="flex items-center gap-4">
            <Avatar className="w-12 h-12 ring-2 ring-primary/10">
              <AvatarImage src={testimonial.avatar} />
              <AvatarFallback>{testimonial.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <h4 className="font-bold text-foreground">{testimonial.name}</h4>
              <p className="text-sm text-muted-foreground">{testimonial.role}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StatsCardProps {
  title: string;
  value: string;
  description: string;
}

export function StatsCard({ title, value, description }: StatsCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="group"
    >
      <div className="p-8 rounded-3xl bg-card border border-border/50 shadow-sm flex flex-col items-center text-center space-y-4 hover:border-primary/30 transition-all duration-300">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
          {title.includes('Raised') || title.includes('Recaudado') || title.includes('Collecté') ? (
            <TrendingUp className="w-7 h-7" />
          ) : title.includes('Donors') || title.includes('Donantes') || title.includes('Donateurs') ? (
            <Users className="w-7 h-7" />
          ) : (
            <Target className="w-7 h-7" />
          )}
        </div>
        <div className="space-y-1">
          <h4 className="text-4xl font-extrabold font-mono tracking-tighter text-foreground">
            {value}
          </h4>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">
            {title}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </motion.div>
  );
}
