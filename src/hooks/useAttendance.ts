import { useState, useEffect, useCallback } from 'react';
import { supabase, Tables } from '@/config/supabase';
import { useAuth } from '@/contexts/AuthContextSupabase';

export interface Session extends Tables<'sessions'> {}

export interface AttendanceRecord extends Tables<'attendance'> {}

export function useSessions() {
  const { userProfile, role } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!userProfile) return;
    
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (role === 'doctor') {
        query = query.eq('created_by', userProfile.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSessions(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  }, [userProfile, role]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const createSession = useCallback(async (sessionData: {
    subjectId: string;
    subjectName: string;
    startTime: Date;
    endTime: Date;
    locationLat: number;
    locationLng: number;
    radius: number;
    notes?: string;
  }) => {
    if (!userProfile) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        subject_id: sessionData.subjectId,
        subject_name: sessionData.subjectName,
        created_by: userProfile.id,
        start_time: sessionData.startTime.toISOString(),
        end_time: sessionData.endTime.toISOString(),
        location_lat: sessionData.locationLat,
        location_lng: sessionData.locationLng,
        radius: sessionData.radius,
        notes: sessionData.notes
      })
      .select()
      .single();

    if (error) throw error;
    
    await fetchSessions();
    return data;
  }, [userProfile, fetchSessions]);

  const endSession = useCallback(async (sessionId: string) => {
    const { error } = await supabase
      .from('sessions')
      .update({
        is_active: false,
        ended_at: new Date().toISOString()
      })
      .eq('id', sessionId);

    if (error) throw error;
    await fetchSessions();
  }, [fetchSessions]);

  const getActiveSessions = useCallback(async () => {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('sessions')
      .select('id, subject_id, subject_name, start_time, end_time, location_lat, location_lng, radius')
      .eq('is_active', true)
      .gte('end_time', now);

    if (error) throw error;
    return data;
  }, []);

  return {
    sessions,
    loading,
    error,
    fetchSessions,
    createSession,
    endSession,
    getActiveSessions
  };
}

export function useAttendance() {
  const { userProfile, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRotatingHash = useCallback(async (sessionId: string) => {
    const { data, error } = await supabase
      .rpc('generate_rotating_hash', { p_session_id: sessionId });

    if (error) throw error;
    return data;
  }, []);

  const markAttendance = useCallback(async (params: {
    sessionId: string;
    rotatingHash: string;
    latitude: number;
    longitude: number;
    deviceFingerprint: string;
    userAgent?: string;
  }) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.rpc('validate_attendance', {
        p_session_id: params.sessionId,
        p_rotating_hash: params.rotatingHash,
        p_latitude: params.latitude,
        p_longitude: params.longitude,
        p_device_fingerprint: params.deviceFingerprint,
        p_user_agent: params.userAgent,
        p_ip_address: null
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Failed to mark attendance');
      }

      const result = data[0];
      
      if (!result.success) {
        throw new Error(result.message);
      }

      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to mark attendance');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSessionAttendance = useCallback(async (sessionId: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    if (error) throw error;
    return data;
  }, []);

  const getStudentHistory = useCallback(async (limit: number = 50) => {
    if (!userProfile) return [];

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userProfile.id)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }, [userProfile]);

  const getAttendanceStats = useCallback(async (sessionId?: string) => {
    if (sessionId) {
      const attendance = await getSessionAttendance(sessionId);
      return {
        totalPresent: attendance.length,
        records: attendance
      };
    }

    if (role === 'owner') {
      const { data, error } = await supabase
        .from('attendance')
        .select('session_id, sessions(subject_name)');
      
      if (error) throw error;
      return data;
    }

    return null;
  }, [role, getSessionAttendance]);

  return {
    loading,
    error,
    getRotatingHash,
    markAttendance,
    getSessionAttendance,
    getStudentHistory,
    getAttendanceStats
  };
}
