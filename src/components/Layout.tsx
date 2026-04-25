import React, { useState, useEffect, useCallback } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Globe, LogOut, User as UserIcon, ChevronDown,
  Heart, LayoutDashboard, Info, Flame, Plus, Gift, ShieldAlert, Wallet
} from 'lucide-react';
import { ROUTE_PATHS, LanguageCode } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { AuthModal } from '@/components/AuthModal';

import { useWeb3 } from '@/context/Web3Context';
interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: 'login' | 'register' }>({
    open: false, tab: 'login',
  });

  const { t, setLanguage, currentLanguage, languages } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const { disconnect } = useWeb3();
  const location = useLocation();
  const handleLogout = useCallback(async () => {
    try {
      await disconnect();
    } catch (err) {
      console.warn('Web3 disconnect error:', err);
    } finally {
      logout();
    }
  }, [disconnect, logout]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const openLogin = () => setAuthModal({ open: true, tab: 'login' });
  const openRegister = () => setAuthModal({ open: true, tab: 'register' });
  const closeAuth = () => setAuthModal((s) => ({ ...s, open: false }));

  const navLinks: { path: string; label: string; icon: React.ElementType }[] = [
    { path: ROUTE_PATHS.HOME, label: t('nav_home'), icon: Heart },
    { path: ROUTE_PATHS.CAMPAIGNS, label: t('nav_campaigns'), icon: Flame },
    { path: ROUTE_PATHS.ABOUT, label: t('nav_about'), icon: Info },
  ];

  if (isAuthenticated) {
    navLinks.push({ path: ROUTE_PATHS.DASHBOARD, label: t('nav_dashboard'), icon: LayoutDashboard });
    if (user?.role !== 'admin') {
      navLinks.push({ path: '/rewards', label: 'Rewards', icon: Gift });
    }
    if (user?.role === 'admin') {
      navLinks.push({ path: '/admin', label: 'Admin', icon: ShieldAlert });
    }
  }

  const springTransition = { type: 'spring', stiffness: 400, damping: 30 };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Auth Modal */}
      <AuthModal
        isOpen={authModal.open}
        onClose={closeAuth}
        defaultTab={authModal.tab}
      />

      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${isScrolled
            ? 'bg-background/80 backdrop-blur-lg border-b border-border py-3'
            : 'bg-transparent py-5'
          }`}
      >
        <div className="container mx-auto px-4 flex items-center justify-between">
          {/* Logo */}
          <Link to={ROUTE_PATHS.HOME} className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg group-hover:scale-110 transition-transform">
              <Heart className="w-6 h-6 fill-current" />
            </div>
            <span className="text-2xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Fundy
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `text-sm font-semibold transition-colors hover:text-primary ${isActive ? 'text-primary' : 'text-muted-foreground'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language Switcher */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <span className="text-lg">{currentLanguage.flag}</span>
                  <span className="uppercase text-xs font-bold">{currentLanguage.code}</span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {languages.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code as LanguageCode)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium">{lang.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Auth */}
            {isAuthenticated ? (
              <>
                {user?.role !== 'admin' && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to={ROUTE_PATHS.CREATE_CAMPAIGN}>
                      <Plus className="w-4 h-4" /> Start Campaign
                    </Link>
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-border">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-5 w-5" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to={ROUTE_PATHS.DASHBOARD} className="cursor-pointer">
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>{t('nav_dashboard')}</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link to={ROUTE_PATHS.CREATE_CAMPAIGN} className="cursor-pointer">
                        <Plus className="mr-2 h-4 w-4" />
                        <span>Start Campaign</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Logout</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={openLogin}>{t('nav_login')}</Button>
                <Button onClick={openRegister} className="shadow-md">{t('nav_register')}</Button>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(currentLanguage.code === 'en' ? 'es' : currentLanguage.code === 'es' ? 'fr' : 'en')}
              className="text-lg"
            >
              {currentLanguage.flag}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative z-50"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            transition={springTransition}
            className="fixed inset-0 z-40 bg-background flex flex-col pt-24 px-6"
          >
            <nav className="flex flex-col gap-6 mb-12">
              {navLinks.map((link) => (
                <NavLink
                  key={link.path}
                  to={link.path}
                  className={({ isActive }) =>
                    `text-2xl font-bold flex items-center gap-4 transition-colors ${isActive ? 'text-primary' : 'text-foreground'
                    }`
                  }
                >
                  <link.icon className="w-6 h-6" />
                  {link.label}
                </NavLink>
              ))}
              {isAuthenticated && (
                <Link to={ROUTE_PATHS.CREATE_CAMPAIGN} className="text-2xl font-bold flex items-center gap-4 text-foreground">
                  <Plus className="w-6 h-6" /> Start Campaign
                </Link>
              )}
            </nav>

            <div className="mt-auto mb-10 space-y-4">
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted">
                    <div className="h-12 w-12 rounded-full overflow-hidden">
                      <img src={user?.avatar} alt={user?.name} />
                    </div>
                    <div>
                      <p className="font-bold">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full justify-start h-12 text-destructive" onClick={handleLogout}>
                    <LogOut className="mr-2 h-5 w-5" /> Logout
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-12" onClick={() => { setIsMobileMenuOpen(false); openLogin(); }}>
                    {t('nav_login')}
                  </Button>
                  <Button className="h-12" onClick={() => { setIsMobileMenuOpen(false); openRegister(); }}>
                    {t('nav_register')}
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-grow pt-24">{children}</main>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1">
              <Link to={ROUTE_PATHS.HOME} className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <span className="text-xl font-bold">Fundy</span>
              </Link>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Making the world a better place through community-driven fundraising. Empowering every individual to be a catalyst for change.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-6">Company</h4>
              <ul className="space-y-4 text-sm text-muted-foreground">
                <li><Link to={ROUTE_PATHS.ABOUT} className="hover:text-primary transition-colors">{t('nav_about')}</Link></li>
                <li><Link to={ROUTE_PATHS.CREATE_CAMPAIGN} className="hover:text-primary transition-colors">Start a Campaign</Link></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">© 2026 Fundy. All rights reserved.</p>

          </div>
        </div>
      </footer>
    </div>
  );
}
