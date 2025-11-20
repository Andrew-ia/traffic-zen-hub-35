import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/hooks/useAuth';
import { resolveApiBase } from '@/lib/apiBase';

export interface Notification {
    id: string;
    user_id: string;
    type: 'message' | 'mention' | 'task_assignment' | 'reminder' | 'system';
    title: string;
    message: string;
    link?: string;
    read: boolean;
    created_at: string;
    metadata?: Record<string, any>;
}

export function useNotifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = useCallback(async () => {
        if (!user?.id) return;

        try {
            const apiBase = resolveApiBase();
            const response = await fetch(`${apiBase}/api/notifications/${user.id}`);

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setNotifications(data.data);
                    setUnreadCount(data.data.length);
                }
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    const markAsRead = async (id: string) => {
        try {
            // Optimistic update
            setNotifications(prev => prev.filter(n => n.id !== id));
            setUnreadCount(prev => Math.max(0, prev - 1));

            const apiBase = resolveApiBase();
            await fetch(`${apiBase}/api/notifications/${id}/read`, {
                method: 'PUT',
            });
        } catch (error) {
            console.error('Error marking notification as read:', error);
            // Revert on error (could be improved)
            fetchNotifications();
        }
    };

    useEffect(() => {
        fetchNotifications();

        if (!user?.id || !supabase) return;

        // Subscribe to real-time changes
        const channel = supabase
            .channel('notifications_changes')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${user.id}`,
                },
                (payload) => {
                    const newNotification = payload.new as Notification;
                    setNotifications(prev => [newNotification, ...prev]);
                    setUnreadCount(prev => prev + 1);

                    // Optional: Play sound or show browser notification
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        refresh: fetchNotifications,
    };
}
