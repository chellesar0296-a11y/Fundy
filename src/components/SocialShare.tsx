import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Copy, Check } from 'lucide-react';
import { Campaign } from '@/lib/index';
import { useLanguage } from '@/hooks/useLanguage';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// ── Inline SVG icons (no react-icons dependency) ──────────────
function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────

interface SocialShareProps {
  campaign: Campaign;
}

export function SocialShare({ campaign }: SocialShareProps) {
  const { t } = useLanguage();
  const [isCopied, setIsCopied] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/campaign/${campaign.id}`
    : '';
  const shareText = encodeURIComponent(`${campaign.title} - ${campaign.shortDescription}`);

  const socialPlatforms = [
    {
      name: 'Facebook',
      Icon: FacebookIcon,
      color: '#1877F2',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'X (Twitter)',
      Icon: XIcon,
      color: '#000000',
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${shareText}`,
    },
    {
      name: 'LinkedIn',
      Icon: LinkedInIcon,
      color: '#0077B5',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'WhatsApp',
      Icon: WhatsAppIcon,
      color: '#25D366',
      href: `https://api.whatsapp.com/send?text=${shareText}%20${encodeURIComponent(shareUrl)}`,
    },
  ];

  const copyToClipboard = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-HTTPS or browsers without clipboard API
        const el = document.createElement('textarea');
        el.value = shareUrl;
        el.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(el);
        el.focus();
        el.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(el);
        if (!ok) throw new Error('execCommand failed');
      }
      setIsCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy. Please copy the link manually from your address bar.');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const itemVariants = {
    hidden: { y: 10, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-foreground font-medium">
        <Share2 className="w-4 h-4" />
        <span className="text-sm uppercase tracking-wider">{t('btn_share')}</span>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-wrap gap-3">
        {socialPlatforms.map(({ name, Icon, color, href }) => (
          <motion.div key={name} variants={itemVariants}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Share on ${name}`}
              className="group flex items-center justify-center w-12 h-12 rounded-full border border-border bg-background transition-all duration-200 hover:border-transparent hover:text-white overflow-hidden relative"
            >
              <span
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                style={{ backgroundColor: color }}
              />
              <Icon className="w-5 h-5 relative z-10 transition-colors" />
            </a>
          </motion.div>
        ))}

        {/* Copy button */}
        <motion.div variants={itemVariants}>
          <Button
            variant="outline" size="icon"
            className="rounded-full w-12 h-12 relative group"
            onClick={copyToClipboard}
            aria-label="Copy link"
          >
            <AnimatePresence mode="wait">
              {isCopied ? (
                <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="text-emerald-500">
                  <Check className="w-5 h-5" />
                </motion.div>
              ) : (
                <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Copy className="w-5 h-5 group-hover:text-primary transition-colors" />
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      </motion.div>

      {/* URL bar */}
      <div className="bg-muted/30 p-3 rounded-lg flex items-center gap-3 border border-border/50 overflow-hidden">
        <div className="flex-1 truncate text-xs text-muted-foreground font-mono">{shareUrl}</div>
        <button
          onClick={copyToClipboard}
          className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors uppercase tracking-tight shrink-0"
        >
          {isCopied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
