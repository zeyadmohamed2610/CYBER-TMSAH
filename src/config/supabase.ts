import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: 'owner' | 'doctor' | 'student'
          student_id: string | null
          failed_login_attempts: number
          locked_until: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role?: 'owner' | 'doctor' | 'student'
          student_id?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: 'owner' | 'doctor' | 'student'
          student_id?: string | null
          failed_login_attempts?: number
          locked_until?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          subject_id: string
          subject_name: string
          created_by: string
          start_time: string
          end_time: string
          is_active: boolean
          location_lat: number
          location_lng: number
          radius: number
          notes: string | null
          attendance_count: number
          created_at: string
          ended_at: string | null
          ended_by: string | null
        }
        Insert: {
          id?: string
          subject_id: string
          subject_name: string
          created_by: string
          start_time: string
          end_time: string
          is_active?: boolean
          location_lat: number
          location_lng: number
          radius: number
          notes?: string | null
          attendance_count?: number
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
        }
        Update: {
          id?: string
          subject_id?: string
          subject_name?: string
          created_by?: string
          start_time?: string
          end_time?: string
          is_active?: boolean
          location_lat?: number
          location_lng?: number
          radius?: number
          notes?: string | null
          attendance_count?: number
          created_at?: string
          ended_at?: string | null
          ended_by?: string | null
        }
      }
      attendance: {
        Row: {
          id: string
          session_id: string
          user_id: string
          student_id: string | null
          name: string
          email: string | null
          timestamp: string
          location_lat: number
          location_lng: number
          distance_from_center: number
          ip_address: string | null
          device_hash: string
          user_agent: string | null
          verified: boolean
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          student_id?: string | null
          name: string
          email?: string | null
          timestamp?: string
          location_lat: number
          location_lng: number
          distance_from_center: number
          ip_address?: string | null
          device_hash: string
          user_agent?: string | null
          verified?: boolean
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          student_id?: string | null
          name?: string
          email?: string | null
          timestamp?: string
          location_lat?: number
          location_lng?: number
          distance_from_center?: number
          ip_address?: string | null
          device_hash?: string
          user_agent?: string | null
          verified?: boolean
        }
      }
      system_logs: {
        Row: {
          id: string
          type: string
          uid: string | null
          email: string | null
          session_id: string | null
          ip: string | null
          user_agent: string | null
          device_hash: string | null
          location_lat: number | null
          location_lng: number | null
          severity: 'info' | 'warning' | 'error' | 'critical'
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          uid?: string | null
          email?: string | null
          session_id?: string | null
          ip?: string | null
          user_agent?: string | null
          device_hash?: string | null
          location_lat?: number | null
          location_lng?: number | null
          severity?: 'info' | 'warning' | 'error' | 'critical'
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          uid?: string | null
          email?: string | null
          session_id?: string | null
          ip?: string | null
          user_agent?: string | null
          device_hash?: string | null
          location_lat?: number | null
          location_lng?: number | null
          severity?: 'info' | 'warning' | 'error' | 'critical'
          details?: Json | null
          created_at?: string
        }
      }
      rate_limits: {
        Row: {
          id: string
          identifier: string
          action: string
          attempts: number[]
          blocked_until: string | null
          created_at: string
          last_failure: string | null
          last_success: string | null
        }
        Insert: {
          id?: string
          identifier: string
          action: string
          attempts?: number[]
          blocked_until?: string | null
          created_at?: string
          last_failure?: string | null
          last_success?: string | null
        }
        Update: {
          id?: string
          identifier?: string
          action?: string
          attempts?: number[]
          blocked_until?: string | null
          created_at?: string
          last_failure?: string | null
          last_success?: string | null
        }
      }
      alerts: {
        Row: {
          id: string
          type: string
          uid: string | null
          ip: string | null
          details: Json | null
          resolved: boolean
          resolved_by: string | null
          resolved_at: string | null
          resolution_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          type: string
          uid?: string | null
          ip?: string | null
          details?: Json | null
          resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          type?: string
          uid?: string | null
          ip?: string | null
          details?: Json | null
          resolved?: boolean
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_notes?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_rotating_hash: {
        Args: {
          session_id: string
        }
        Returns: {
          hash: string
          expires_at: number
          window_start: number
        }
      }
      validate_attendance: {
        Args: {
          p_session_id: string
          p_rotating_hash: string
          p_latitude: number
          p_longitude: number
          p_device_fingerprint: string
          p_device_info: Json
        }
        Returns: {
          success: boolean
          message: string
          attendance_id: string | null
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
