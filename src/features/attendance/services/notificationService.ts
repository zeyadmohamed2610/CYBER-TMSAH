/**
 * Notification service for managing user notifications
 */
import { supabase } from "@/lib/supabaseClient";

export interface Notification {
    id: string;
    user_id: string;
    type: string;
    title: string;
    message: string | null;
    read: boolean;
    created_at: string;
}

export interface NotificationInput {
    type: string;
    title: string;
    message?: string;
}

export const notificationService = {
    /**
     * Get all notifications for the current user
     */
    async getNotifications(): Promise<Notification[]> {
        const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data ?? [];
    },

    /**
     * Get unread notifications count
     */
    async getUnreadCount(): Promise<number> {
        const { data, error, count } = await supabase
            .from("notifications")
            .select("id", { count: 'exact' })
            .eq("read", false);

        if (error) return 0;
        return count ?? 0;
    },

    /**
     * Mark notification as read
     */
    async markAsRead(notificationId: string): Promise<void> {
        const { error } = await supabase
            .from("notifications")
            .update({ read: true })
            .eq("id", notificationId);

        if (error) throw error;
    },

    /**
     * Mark all notifications as read
     */
    async markAllAsRead(): Promise<void> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return;

        const { error } = await supabase
            .from("notifications")
            .update({ read: true })
            .eq("user_id", userId)
            .eq("read", false);

        if (error) throw error;
    },

    /**
     * Create local notification (stored in localStorage for now)
     */
    async createLocalNotification(input: NotificationInput): Promise<Notification> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) throw new Error("Not authenticated");

        const localNotifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        const newNotification: Notification = {
            id: crypto.randomUUID(),
            user_id: userId,
            type: input.type,
            title: input.title,
            message: input.message || null,
            read: false,
            created_at: new Date().toISOString(),
        };

        localNotifications.push(newNotification);
        localStorage.setItem("notifications", JSON.stringify(localNotifications));

        return newNotification;
    },

    /**
     * Get local notifications
     */
    async getLocalNotifications(): Promise<Notification[]> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return [];

        const localNotifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        return localNotifications.filter((n: Notification) => n.user_id === userId);
    },

    /**
     * Clear local notifications
     */
    async clearLocalNotifications(): Promise<void> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) return;

        const localNotifications = JSON.parse(localStorage.getItem("notifications") || "[]");
        const filtered = localNotifications.filter((n: Notification) => n.user_id !== userId);
        localStorage.setItem("notifications", JSON.stringify(filtered));
    },
};