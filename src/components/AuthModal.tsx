import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, ArrowRight, Loader2, Heart, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useWeb3 } from '@/context/Web3Context';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

const registerSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
});

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [tab, setTab] = useState<'login' | 'register'>(defaultTab);
  const { login, register, isLoading } = useAuth();
  const { t } = useLanguage();

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const { connect: connectWallet, isConnected, address } = useWeb3();

  async function onLogin(values: z.infer<typeof loginSchema>) {
    try {
      await login(values.email, values.password);
      toast.success('Welcome back!');
      onClose();
    } catch (error: any) {
      // Clean error message
      const msg = error.message || 'Login failed';
      if (msg.includes('Invalid login') || msg.includes('credentials')) {
        toast.error('Incorrect email or password.');
      } else {
        toast.error(msg);
      }
    }
  }

  async function onRegister(values: z.infer<typeof registerSchema>) {
    try {
      // Check if email already exists
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', values.email)
        .maybeSingle();

      if (existing) {
        toast.error('This email is already registered. Please log in instead.');
        setTab('login');
        return;
      }

      // Require wallet connection before registering
      if (!isConnected || !address) {
        toast.error('Please connect your MetaMask wallet before creating an account.');
        await connectWallet();
        return;
      }

      await register(values.name, values.email, values.password);
      toast.success('Account created! Please check your email to confirm.');
      onClose();
    } catch (error: any) {
      const msg = error.message || 'Registration failed';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        toast.error('This email is already registered.');
      } else {
        toast.error(msg);
      }
    }
  }

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="relative p-6 pb-0">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                    <Heart className="w-5 h-5 fill-current" />
                  </div>
                  <span className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    Fundy
                  </span>
                </div>

                {/* Tab switcher */}
                <div className="flex bg-muted rounded-xl p-1 mb-6">
                  <button
                    onClick={() => setTab('login')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      tab === 'login' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {t('nav_login')}
                  </button>
                  <button
                    onClick={() => setTab('register')}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      tab === 'register' ? 'bg-card shadow text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {t('nav_register')}
                  </button>
                </div>
              </div>

              <div className="p-6 pt-0">
                <AnimatePresence mode="wait">
                  {tab === 'login' ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                    >
                      <div className="mb-5">
                        <h2 className="text-2xl font-extrabold">{t('login_title')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('login_subtitle')}</p>
                      </div>
                      <Form {...loginForm}>
                        <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                          <FormField
                            control={loginForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('form_email')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="you@example.com" className="pl-10" {...field} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={loginForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('form_password')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input type="password" placeholder="••••••••" className="pl-10" {...field} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" className="w-full h-11 font-bold" disabled={isLoading}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                              <>{t('btn_login')} <ArrowRight className="ml-2 w-4 h-4" /></>
                            )}
                          </Button>
                        </form>
                      </Form>
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Don't have an account?{' '}
                        <button onClick={() => setTab('register')} className="text-primary font-semibold hover:underline">
                          Sign up
                        </button>
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                    >
                      <div className="mb-5">
                        <h2 className="text-2xl font-extrabold">{t('register_title')}</h2>
                        <p className="text-sm text-muted-foreground mt-1">{t('register_subtitle')}</p>
                      </div>
                      <Form {...registerForm}>
                        <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                          <FormField
                            control={registerForm.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('form_name')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Jane Doe" className="pl-10" {...field} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('form_email')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="you@example.com" className="pl-10" {...field} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('form_password')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input type="password" placeholder="••••••••" className="pl-10" {...field} />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* Wallet connect step */}
                          <div className={`p-3 rounded-lg border text-sm ${isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                            {isConnected ? (
                              <div className="flex items-center gap-2 text-emerald-700">
                                <span className="text-base">✅</span>
                                <div>
                                  <p className="font-semibold text-xs">Wallet connected</p>
                                  <p className="font-mono text-xs">{address?.slice(0,10)}...{address?.slice(-6)}</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-amber-800 font-semibold text-xs flex items-center gap-1">
                                  <Wallet className="w-3.5 h-3.5" /> MetaMask wallet required
                                </p>
                                <p className="text-amber-700 text-xs">Your wallet is permanently linked to this account.</p>
                                <Button type="button" size="sm" variant="outline" onClick={connectWallet}
                                  className="w-full border-amber-300 text-amber-800 hover:bg-amber-100">
                                  🦊 Connect MetaMask
                                </Button>
                              </div>
                            )}
                          </div>

                          <Button type="submit" className="w-full h-11 font-bold" disabled={isLoading || !isConnected}>
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                              <>{t('btn_register')} <ArrowRight className="ml-2 w-4 h-4" /></>
                            )}
                          </Button>
                        </form>
                      </Form>
                      <p className="text-center text-sm text-muted-foreground mt-4">
                        Already have an account?{' '}
                        <button onClick={() => setTab('login')} className="text-primary font-semibold hover:underline">
                          Log in
                        </button>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
