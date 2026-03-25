/**
 * User settings service for managing user preferences
 */
import { supabase } from "@/lib/supabaseClient";
import type { UserSettings } from "../types";

const defaultSettings: UserSettings = {
    notifications: {
        email: false,
        push: true,
        sessionReminders: true,
    },
    display: {
        language: 'ar',
    },
};

export const userSettingsService = {
    /**
     * Get user settings
     */
    async getSettings(): Promise<UserSettings> {
        try {
            const { data, error } = await supabase
                .from("user_settings")
                .select("settings")
                .single();

            if (error) {
                // If no settings exist, return defaults
                if (error.message.includes("No rows")) {
                    return defaultSettings;
                }
                throw error;
            }

            return { ...defaultSettings, ...(data?.settings || {}) };
        } catch (error) {
            console.error("Error fetching settings:", error);
            return defaultSettings;
        }
    },

    /**
     * Update user settings
     */
    async updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from("user_settings")
            .upsert({
                user_id: userId,
                settings: settings,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id'
            })
            .select()
            .single();

        if (error) throw error;

        return { ...defaultSettings, ...(data?.settings || {}) };
    },

    /**
     * Save local settings (for offline support)
     */
    saveLocalSettings(settings: Partial<UserSettings>): void {
        const current = this.getLocalSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem("user_settings", JSON.stringify(updated));
    },

    /**
     * Get local settings
     */
    getLocalSettings(): UserSettings {
        const stored = localStorage.getItem("user_settings");
        if (stored) {
            try {
                return { ...defaultSettings, ...JSON.parse(stored) };
            } catch {
                return defaultSettings;
            }
        }
        return defaultSettings;
    },

    /**
     * Reset settings to defaults
     */
    async resetSettings(): Promise<UserSettings> {
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) throw new Error("Not authenticated");

        const { error } = await supabase
            .from("user_settings")
            .delete()
            .eq("user_id", userId);

        if (error) throw error;

        localStorage.removeItem("user_settings");
        return defaultSettings;
    },
};