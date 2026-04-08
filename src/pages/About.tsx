import { motion } from "framer-motion";
import { Heart, Users, Target, ShieldCheck, Globe, Zap, Award } from "lucide-react";
import { IMAGES } from "@/assets/images";
import { useLanguage } from "@/hooks/useLanguage";
import { StatsCard } from "@/components/Cards";
import { ROUTE_PATHS } from "@/lib/index";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const teamMembers = [
  {
    name: "Sarah Jenkins",
    role: "Chief Executive Officer",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400",
    bio: "Passionate about leveraging technology to democratize philanthropy."
  },
  {
    name: "David Chen",
    role: "Chief Technology Officer",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
    bio: "Expert in secure distributed systems and fintech innovation."
  },
  {
    name: "Elena Rodriguez",
    role: "Head of Community",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400",
    bio: "Dedicated to building bridges between donors and global causes."
  },
  {
    name: "Marcus Thorne",
    role: "Product Design Lead",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
    bio: "Architect of the Fundy user experience and visual language."
  }
];

const values = [
  {
    icon: ShieldCheck,
    title: "Radical Transparency",
    description: "Every dollar is tracked, every impact is measured. We believe trust is earned through openness."
  },
  {
    icon: Heart,
    title: "Empathy First",
    description: "We design our platform around the human stories that drive meaningful change in the world."
  },
  {
    icon: Zap,
    title: "Swift Action",
    description: "When crisis strikes, our platform ensures funds reach those in need with unparalleled speed."
  },
  {
    icon: Globe,
    title: "Global Reach",
    description: "Geography should never be a barrier to generosity or receiving support."
  }
];

export default function About() {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative py-24 lg:py-32 bg-primary/5">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block px-4 py-1.5 mb-6 text-sm font-semibold tracking-wider text-primary uppercase bg-primary/10 rounded-full"
            >
              Our Mission
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl md:text-6xl font-extrabold text-foreground mb-8 leading-tight"
            >
              Empowering Change, <br />
              <span className="text-primary">One Fundy at a Time</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl text-muted-foreground mb-10 leading-relaxed"
            >
              Founded in 2026, Fundy was born from a simple idea: that fundraising should be as joyful as the impact it creates. We've built a platform where transparency meets community, making it easier than ever for people to support the causes they care about.
            </motion.p>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute right-0 top-0 w-1/2 h-full opacity-20 pointer-events-none hidden lg:block">
          <img 
            src={IMAGES.HERO_COMMUNITY_7} 
            alt="Community Impact" 
            className="w-full h-full object-cover rounded-l-[100px]"
          />
        </div>
      </section>

      {/* Statistics Section */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatsCard 
              title={t('stats_raised')} 
              value="$124M+" 
              description="Total funds distributed to vetted causes since launch."
            />
            <StatsCard 
              title={t('stats_donors')} 
              value="2.5M+" 
              description="Individual supporters across 140 different countries."
            />
            <StatsCard 
              title={t('stats_campaigns')} 
              value="18,400+" 
              description="Successful campaigns ranging from medical to education."
            />
            <StatsCard 
              title="Lives Impacted" 
              value="8.2M" 
              description="Direct beneficiaries of our global community's generosity."
            />
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              <div className="aspect-square rounded-[2rem] overflow-hidden shadow-2xl">
                <img src={IMAGES.HERO_COMMUNITY_10} alt="Our Story" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-8 -right-8 w-48 h-48 bg-accent rounded-3xl p-6 hidden md:flex flex-col justify-center items-center text-center shadow-xl">
                <Award className="w-12 h-12 text-accent-foreground mb-2" />
                <p className="font-bold text-accent-foreground leading-tight italic">Trusted by 500+ Non-Profits</p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">The Story Behind Fundy</h2>
              <div className="space-y-6 text-lg text-muted-foreground">
                <p>
                  In a world full of complex problems, we noticed that many donors felt disconnected from the outcomes of their contributions. The process was often sterile, opaque, and frankly, a bit dull.
                </p>
                <p>
                  We set out to change that. Fundy—a blend of 'Fund' and 'Unity'—was designed to bring back the human connection. We integrated real-time storytelling, live progress tracking, and interactive community features into every campaign.
                </p>
                <p>
                  Today, we are more than just a platform. We are a movement of millions of people who believe that when we act together, no challenge is too great to overcome.
                </p>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-8">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Target className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Our Vision</h4>
                    <p className="text-sm text-muted-foreground">A world where every good idea has the resources it needs to thrive.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-secondary/10 rounded-xl">
                    <Users className="w-6 h-6 text-secondary-foreground" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Our Community</h4>
                    <p className="text-sm text-muted-foreground">Built on trust, powered by collective action across all borders.</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Values That Guide Us</h2>
            <p className="text-muted-foreground text-lg">We operate with a core set of principles that ensure our platform remains safe, effective, and inspiring for everyone.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <value.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{value.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Meet the Visionaries</h2>
            <p className="text-muted-foreground text-lg">Our diverse team brings together decades of experience in technology, humanitarian aid, and social enterprise.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            {teamMembers.map((member, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="relative aspect-[4/5] rounded-[2rem] overflow-hidden mb-6">
                  <img 
                    src={member.image} 
                    alt={member.name} 
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-6">
                    <p className="text-white text-sm italic">"{member.bio}"</p>
                  </div>
                </div>
                <h3 className="text-xl font-bold">{member.name}</h3>
                <p className="text-primary font-medium">{member.role}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto bg-white/10 backdrop-blur-md border border-white/20 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-32 h-32 bg-accent/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
            <div className="absolute bottom-0 right-0 w-48 h-48 bg-secondary/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
            
            <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6 relative z-10">
              Ready to be part of the story?
            </h2>
            <p className="text-white/80 text-lg md:text-xl mb-10 max-w-2xl mx-auto relative z-10">
              Whether you're starting a new initiative or supporting a neighbor, your journey toward impact begins here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center relative z-10">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-10 h-14 rounded-full shadow-lg">
                <Link to={ROUTE_PATHS.REGISTER}>Join the Community</Link>
              </Button>
              <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 text-lg px-10 h-14 rounded-full">
                <Link to={ROUTE_PATHS.CAMPAIGNS}>Browse Campaigns</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
