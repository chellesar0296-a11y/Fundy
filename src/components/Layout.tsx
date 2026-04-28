import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, X, Globe, LogOut, User as UserIcon, ChevronDown,
  Heart, LayoutDashboard, Info, Flame, Plus, Gift, ShieldAlert, Wallet, Loader2
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
import { toast } from 'sonner';

import { NotificationBell } from '@/components/Notification';
import { useNotifications } from '@/hooks/useNotification';
import { useRefundNotifications } from '@/hooks/userefundnotification';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [authModal, setAuthModal] = useState<{ open: boolean; tab: 'login' | 'register' }>({
    open: false, tab: 'login',
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const { t, setLanguage, currentLanguage, languages } = useLanguage();
  const { user, isAuthenticated, logout } = useAuth();
  const { disconnect, provider, address } = useWeb3();
  const location = useLocation();

  // Refs to prevent multiple logout attempts
  const logoutInProgressRef = useRef(false);
  const logoutTimeoutRef = useRef<NodeJS.Timeout>();

  // ── Refund notification check on page load ────────────────
  useRefundNotifications({
    userId: user?.id ?? null,
    address,
    provider,
  });
  const { notifications, markAllRead } = useNotifications(user?.id ?? null);

  // Check if user is admin
  const isAdmin = user?.role === 'admin';

  // Improved logout handler with better error handling and state management
  const handleLogout = useCallback(async () => {
    // Prevent multiple simultaneous logout attempts
    if (logoutInProgressRef.current || isLoggingOut) {
      console.log('Logout already in progress, ignoring request');
      toast.info('Logout already in progress...');
      return;
    }

    // Set timeout to prevent infinite hanging
    logoutTimeoutRef.current = setTimeout(() => {
      if (logoutInProgressRef.current || isLoggingOut) {
        console.error('Logout timeout - forcing reset');
        logoutInProgressRef.current = false;
        setIsLoggingOut(false);
        toast.error('Logout timed out. Please refresh the page.');
      }
    }, 10000);

    logoutInProgressRef.current = true;
    setIsLoggingOut(true);

    try {
      // Step 1: Disconnect Web3 if connected
      if (disconnect) {
        try {
          await Promise.race([
            disconnect(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Web3 disconnect timeout')), 5000)
            )
          ]);
        } catch (web3Err) {
          console.warn('Web3 disconnect error (non-critical):', web3Err);
          // Don't throw - continue with auth logout even if web3 disconnect fails
        }
      }

      // Step 2: Clear any pending notifications or subscriptions
      if (markAllRead) {
        try {
          await Promise.race([
            markAllRead(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Mark read timeout')), 3000)
            )
          ]);
        } catch (notifErr) {
          console.warn('Error clearing notifications (non-critical):', notifErr);
        }
      }

      // Step 3: Clear any stored data
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
      } catch (storageErr) {
        console.warn('Error clearing storage (non-critical):', storageErr);
      }

      // Step 4: Perform auth logout
      await Promise.race([
        logout(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Auth logout timeout')), 5000)
        )
      ]);

      // Step 5: Close mobile menu if open
      setIsMobileMenuOpen(false);

      // Step 6: Show success message
      toast.success('Successfully logged out');

    } catch (err: any) {
      console.error('Logout error:', err);

      // Even if there's an error, we should try to clear local state
      try {
        // Force clear local storage
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');

        // Force logout from auth context
        await logout();

        toast.warning('Logged out with some issues. Please refresh the page if needed.');
      } catch (finalErr) {
        console.error('Final logout attempt failed:', finalErr);
        toast.error('Failed to logout. Please try refreshing the page.');
      }
    } finally {
      // Clear timeout
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }

      // Reset state after delay to prevent immediate re-attempts
      setTimeout(() => {
        logoutInProgressRef.current = false;
        setIsLoggingOut(false);
      }, 500);
    }
  }, [disconnect, logout, markAllRead, isLoggingOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, []);

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
    if (user?.role !== 'admin') {
      navLinks.push({ path: ROUTE_PATHS.DASHBOARD, label: t('nav_dashboard'), icon: LayoutDashboard });
    }
    if (!isAdmin) {
      navLinks.push({ path: '/rewards', label: 'Rewards', icon: Gift });
    }
    if (isAdmin) {
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
                {/* Only show Start Campaign button for non-admin users */}
                {!isAdmin && (
                  <Button asChild variant="outline" size="sm" className="gap-2">
                    <Link to={ROUTE_PATHS.CREATE_CAMPAIGN}>
                      <Plus className="w-4 h-4" /> Start Campaign
                    </Link>
                  </Button>
                )}

                {/* Notification Bell */}
                <NotificationBell notifications={notifications} onMarkRead={markAllRead} />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="relative h-10 w-10 rounded-full p-0 overflow-hidden border border-border"
                      disabled={isLoggingOut}
                    >
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
                    {/* Only show Start Campaign in dropdown for non-admin users */}
                    {!isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link to={ROUTE_PATHS.CREATE_CAMPAIGN} className="cursor-pointer">
                          <Plus className="mr-2 h-4 w-4" />
                          <span>Start Campaign</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className={`cursor-pointer text-destructive focus:text-destructive ${isLoggingOut ? 'opacity-50 pointer-events-none' : ''}`}
                      disabled={isLoggingOut}
                    >
                      {isLoggingOut ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          <span>Logging out...</span>
                        </>
                      ) : (
                        <>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Logout</span>
                        </>
                      )}
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
            {/* Mobile Notification Bell (shown when logged in) */}
            {isAuthenticated && (
              <NotificationBell notifications={notifications} onMarkRead={markAllRead} />
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLanguage(currentLanguage.code === 'en' ? 'es' : currentLanguage.code === 'es' ? 'fr' : 'en')}
              className="text-lg"
              disabled={isLoggingOut}
            >
              {currentLanguage.flag}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="relative z-50"
              disabled={isLoggingOut}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && !isLoggingOut && (
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
              {/* Only show Start Campaign in mobile menu for non-admin users */}
              {isAuthenticated && !isAdmin && (
                <Link to={ROUTE_PATHS.CREATE_CAMPAIGN} className="text-2xl font-bold flex items-center gap-4 text-foreground">
                  <Plus className="w-6 h-6" /> Start Campaign
                </Link>
              )}
            </nav>

            <div className="mt-auto mb-10 space-y-4">
              {isAuthenticated ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-primary/20 flex items-center justify-center">
                      {user?.avatar ? (
                        <img src={user.avatar} alt={user?.name} className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-bold">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-start h-12 text-destructive"
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Logging out...
                      </>
                    ) : (
                      <>
                        <LogOut className="mr-2 h-5 w-5" /> Logout
                      </>
                    )}
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

      {/* Loading Overlay (optional - shows during logout) */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card rounded-lg p-6 shadow-lg flex items-center gap-3 pointer-events-auto">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="font-medium">Logging out...</span>
          </div>
        </div>
      )}

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