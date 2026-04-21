export const ROUTE_PATHS = { 
  HOME: '/',
  CAMPAIGNS: '/campaigns',
  CAMPAIGN_DETAIL: '/campaign/:id',
  ABOUT: '/about',
  DASHBOARD: '/dashboard',
  CREATE_CAMPAIGN: '/create-campaign',
  LOGIN: '/login',
  REGISTER: '/register',
} as const;

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'admin' | 'donor' | 'organizer';
  bio?: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string;
  category: 'Medical' | 'Education' | 'Environment' | 'Disaster' | 'Community'
    | 'Personal' | 'Creative' | 'Technology' | 'Business' | 'Animals' | 'Sports';
  goalAmount: number;
  currentAmount: number;
  donorCount: number;
  image: string;
  endDate: string;
  onChainId?: number | null;   // on-chain campaign ID from smart contract
  organizer: {
    id: string;
    name: string;
    avatar?: string;
    isVerified: boolean;
  };
  status: 'active' | 'completed' | 'draft' | 'cancelled';
}

export interface Donation {
  id: string;
  campaignId: string;
  donorId?: string;
  donorName: string;
  amount: number;
  date: string;
  message?: string;
  isAnonymous: boolean;
}

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const translations: Record<LanguageCode, Record<string, string>> = {
  zh: {
    nav_home: '首页',
    nav_campaigns: '众筹活动',
    nav_about: '关于我们',
    nav_dashboard: '控制台',
    nav_login: '登录',
    nav_register: '注册',
    btn_donate: '立即捐款',
    btn_share: '分享',
    btn_login: '登录',
    btn_register: '创建账户',
    btn_learn_more: '了解更多',
    btn_view_all: '查看全部活动',
    hero_title: '赋能改变，从 Fundy 开始',
    hero_subtitle: '加入全球社区，共同创造真实影响力。今天就开始你的众筹之旅或支持一个公益活动。',
    stats_raised: '全球募集总额',
    stats_donors: '活跃捐款人',
    stats_campaigns: '成功活动',
    label_goal: '目标',
    label_raised: '已募集',
    label_days_left: '天剩余',
    label_organizer: '发起人',
    login_title: '欢迎回来',
    login_subtitle: '登录以管理你的捐款和活动',
    register_title: '加入 Fundy',
    register_subtitle: '今天就开始改变世界',
    form_email: '邮箱地址',
    form_password: '密码',
    form_name: '全名',
    footer_rights: '© 2026 Fundy. 版权所有。',
    campaign_search_placeholder: '搜索活动...',
    campaign_filter_all: '所有分类',
    donation_success: '感谢您的慷慨捐助！',
    dashboard_welcome: '欢迎回来，{name}',
    dashboard_total_donated: '累计捐款',
    dashboard_impact: '受益人数',
    hero_badge: '全球改变生命',
    featured_title: '精选公益活动',
    featured_subtitle: '精心挑选的活动，需要你的立即支持，共创持久影响。',
    cta_title: '准备好发起你自己的活动了吗？',
    cta_subtitle: '加入数千名正在改变世界的发起人。只需 5 分钟即可设置完成。',
  },
  en: {
    nav_home: 'Home',
    nav_campaigns: 'Campaigns',
    nav_about: 'About',
    nav_dashboard: 'Dashboard',
    nav_login: 'Login',
    nav_register: 'Sign Up',
    btn_donate: 'Donate Now',
    btn_share: 'Share',
    btn_login: 'Login',
    btn_register: 'Create Account',
    btn_learn_more: 'Learn More',
    btn_view_all: 'View All Campaigns',
    hero_title: 'Empower Change, One Fundy at a Time',
    hero_subtitle: 'Join a global community dedicated to making a real impact. Start your fundraising journey or support a cause today.',
    stats_raised: 'Raised Worldwide',
    stats_donors: 'Active Donors',
    stats_campaigns: 'Successful Campaigns',
    label_goal: 'Goal',
    label_raised: 'Raised',
    label_days_left: 'days left',
    label_organizer: 'Organized by',
    login_title: 'Welcome Back',
    login_subtitle: 'Log in to manage your donations and campaigns',
    register_title: 'Join Fundy',
    register_subtitle: 'Start making a difference today',
    form_email: 'Email Address',
    form_password: 'Password',
    form_name: 'Full Name',
    footer_rights: '© 2026 Fundy. All rights reserved.',
    campaign_search_placeholder: 'Search campaigns...',
    campaign_filter_all: 'All Categories',
    donation_success: 'Thank you for your generous contribution!',
    dashboard_welcome: 'Welcome back, {name}',
    dashboard_total_donated: 'Total Donated',
    dashboard_impact: 'Lives Impacted',
    hero_badge: 'Transforming Lives Globally',
    featured_title: 'Featured Causes',
    featured_subtitle: 'Handpicked campaigns that need your immediate support to create a lasting difference.',
    cta_title: 'Ready to Start Your Own Campaign?',
    cta_subtitle: 'Join thousands of organizers making a real difference. It only takes 5 minutes to set up.',
  },
  es: {
    nav_home: 'Inicio',
    nav_campaigns: 'Campañas',
    nav_about: 'Nosotros',
    nav_dashboard: 'Panel',
    nav_login: 'Entrar',
    nav_register: 'Registro',
    btn_donate: 'Donar Ahora',
    btn_share: 'Compartir',
    btn_login: 'Iniciar Sesión',
    btn_register: 'Crear Cuenta',
    btn_learn_more: 'Saber Más',
    btn_view_all: 'Ver Todas las Campañas',
    hero_title: 'Impulsa el Cambio, Fundy a Fundy',
    hero_subtitle: 'Únete a una comunidad global dedicada a generar un impacto real. Comienza tu viaje de recaudación o apoya una causa hoy.',
    stats_raised: 'Recaudado en el mundo',
    stats_donors: 'Donantes Activos',
    stats_campaigns: 'Campañas Exitosas',
    label_goal: 'Meta',
    label_raised: 'Recaudado',
    label_days_left: 'días restantes',
    label_organizer: 'Organizado por',
    login_title: 'Bienvenido de Nuevo',
    login_subtitle: 'Inicia sesión para gestionar tus donaciones',
    register_title: 'Únete a Fundy',
    register_subtitle: 'Empieza a marcar la diferencia hoy',
    form_email: 'Correo Electrónico',
    form_password: 'Contraseña',
    form_name: 'Nombre Completo',
    footer_rights: '© 2026 Fundy. Todos los derechos reservados.',
    campaign_search_placeholder: 'Buscar campañas...',
    campaign_filter_all: 'Todas las Categorías',
    donation_success: '¡Gracias por su generosa contribución!',
    dashboard_welcome: 'Bienvenido de nuevo, {name}',
    dashboard_total_donated: 'Total Donado',
    dashboard_impact: 'Vidas Impactadas',
    hero_badge: 'Transformando Vidas Globalmente',
    featured_title: 'Causas Destacadas',
    featured_subtitle: 'Campañas seleccionadas que necesitan tu apoyo inmediato para crear una diferencia duradera.',
    cta_title: '¿Listo para Comenzar Tu Propia Campaña?',
    cta_subtitle: 'Únete a miles de organizadores haciendo una diferencia real. Solo toma 5 minutos configurarlo.',
  },
  fr: {
    nav_home: 'Accueil',
    nav_campaigns: 'Campagnes',
    nav_about: 'À Propos',
    nav_dashboard: 'Tableau',
    nav_login: 'Connexion',
    nav_register: 'S\'inscrire',
    btn_donate: 'Faire un don',
    btn_share: 'Partager',
    btn_login: 'Connexion',
    btn_register: 'Créer un compte',
    btn_learn_more: 'En savoir plus',
    btn_view_all: 'Voir toutes les campagnes',
    hero_title: 'Favorisez le changement, un Fundy à la fois',
    hero_subtitle: 'Rejoignez une communauté mondiale dédiée à avoir un impact réel. Commencez votre collecte de fonds ou soutenez une cause aujourd\'hui.',
    stats_raised: 'Collecté dans le monde',
    stats_donors: 'Donateurs actifs',
    stats_campaigns: 'Campagnes réussies',
    label_goal: 'Objectif',
    label_raised: 'Collecté',
    label_days_left: 'jours restants',
    label_organizer: 'Organisé par',
    login_title: 'Bon Retour',
    login_subtitle: 'Connectez-vous pour gérer vos dons',
    register_title: 'Rejoindre Fundy',
    register_subtitle: 'Commencez à faire une différence dès aujourd\'hui',
    form_email: 'Adresse e-mail',
    form_password: 'Mot de passe',
    form_name: 'Nom complet',
    footer_rights: '© 2026 Fundy. Tous droits réservés.',
    campaign_search_placeholder: 'Rechercher des campagnes...',
    campaign_filter_all: 'Toutes les catégories',
    donation_success: 'Merci pour votre généreuse contribution!',
    dashboard_welcome: 'Bon retour, {name}',
    dashboard_total_donated: 'Total des dons',
    dashboard_impact: 'Vies impactées',
    hero_badge: 'Transformer des vies dans le monde entier',
    featured_title: 'Causes Vedettes',
    featured_subtitle: 'Des campagnes sélectionnées qui ont besoin de votre soutien immédiat pour créer une différence durable.',
    cta_title: 'Prêt à Lancer Votre Propre Campagne?',
    cta_subtitle: 'Rejoignez des milliers d\'organisateurs qui font une vraie différence. Cela ne prend que 5 minutes.',
  },
};

// ── Reward / NFT types (P4) ───────────────────────────────────
export type RewardType = 'ERC20' | 'ERC721';
export type RewardStatus = 'pending' | 'minted' | 'claimed' | 'failed';

export interface Reward {
  id: string;
  campaignId: string;
  campaignTitle: string;
  donorId: string;
  type: RewardType;
  name: string;
  description: string;
  imageUrl?: string;
  tokenAmount?: number;   // for ERC-20
  tokenId?: string;       // for ERC-721
  contractAddress?: string;
  status: RewardStatus;
  mintedAt?: string;
  claimedAt?: string;
  createdAt: string;
}

// ── Credit score (P1) ─────────────────────────────────────────
export interface CreditScore {
  score: number;          // 0-1000
  level: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  totalDonations: number;
  campaignsSupported: number;
  streakDays: number;
}

// ── Wallet (Web3) ─────────────────────────────────────────────
export interface WalletInfo {
  address: string;
  chainId: number;
  balance: string;        // in ETH
  isConnected: boolean;
}

// ── Admin types (P5) ─────────────────────────────────────────
export interface AdminStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalDonations: number;
  totalRaised: number;
  pendingRewards: number;
  totalUsers: number;
}

