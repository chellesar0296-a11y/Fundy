import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Notification } from '@/components/Notification';

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    supabase
      .from('notifications')
      .select('*, campaigns(slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (mounted) setNotifications((data as Notification[]) ?? []);
      });

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (mounted) setNotifications(prev => [payload.new as Notification, ...prev]);
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      channel.unsubscribe();
    };
  }, [userId]);

  async function markAllRead() {
    if (!userId) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  return { notifications, markAllRead };
}