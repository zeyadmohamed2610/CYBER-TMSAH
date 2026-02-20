import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContextSupabase';
import { useSessions, useAttendance } from '@/hooks/useAttendance';
import { useGeoLocation, haversineDistance } from '@/hooks/useGeoLocation';
import { useDeviceFingerprint } from '@/lib/fingerprint';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';

interface ActiveSession {
  id: string;
  subject_id: string;
  subject_name: string;
  start_time: string;
  end_time: string;
  location_lat: number;
  location_lng: number;
  radius: number;
}

export default function MarkAttendance() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { getActiveSessions } = useSessions();
  const { markAttendance, getRotatingHash } = useAttendance();
  
  const { coordinates, error: geoError, loading: geoLoading, getCurrentPosition } = useGeoLocation();
  const { fingerprint, deviceInfo } = useDeviceFingerprint();
  
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const activeSessions = await getActiveSessions();
        setSessions(activeSessions || []);
      } catch (err) {
        console.error('Error fetching sessions:', err);
        setError('Failed to load active sessions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, [getActiveSessions]);

  useEffect(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  useEffect(() => {
    if (selectedSession && coordinates) {
      const dist = haversineDistance(
        { latitude: coordinates.latitude, longitude: coordinates.longitude },
        { latitude: selectedSession.location_lat, longitude: selectedSession.location_lng }
      );
      setDistance(dist);
    }
  }, [selectedSession, coordinates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!selectedSession) {
      setError('Please select a session');
      setSubmitting(false);
      return;
    }

    if (!coordinates) {
      setError('Location is required. Please enable location access.');
      setSubmitting(false);
      return;
    }

    if (!fingerprint) {
      setError('Device fingerprint could not be generated. Please refresh the page.');
      setSubmitting(false);
      return;
    }

    if (code.length !== 6) {
      setError('Please enter a valid 6-digit code');
      setSubmitting(false);
      return;
    }

    try {
      await markAttendance({
        sessionId: selectedSession.id,
        rotatingHash: code,
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        deviceFingerprint: fingerprint,
        userAgent: navigator.userAgent
      });
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const isWithinRadius = selectedSession && distance !== null && distance <= selectedSession.radius;

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-green-500/50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-500">Attendance Marked!</h2>
            <p className="text-muted-foreground mt-2">
              Your attendance has been successfully recorded.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">Mark Attendance</h1>
        <p className="text-muted-foreground mt-2">
          Select an active session and enter the code provided by your instructor
        </p>
      </div>

      {geoError && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{geoError}</AlertDescription>
        </Alert>
      )}

      {!coordinates && !geoLoading && (
        <Alert className="mb-4">
          <MapPin className="h-4 w-4" />
          <AlertDescription>
            <Button variant="link" onClick={getCurrentPosition} className="p-0 h-auto">
              Click here to enable location access
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Active Sessions</h3>
            <p className="text-muted-foreground mt-2">
              There are no active attendance sessions right now.
            </p>
            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Session</CardTitle>
              <CardDescription>Choose the active session for your class</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedSession(session)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSession?.id === session.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">{session.subject_name}</h4>
                      <p className="text-sm text-muted-foreground">{session.subject_id}</p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(session.start_time).toLocaleTimeString()} - 
                        {new Date(session.end_time).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {selectedSession && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Location Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {geoLoading ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Getting your location...
                    </div>
                  ) : coordinates ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {isWithinRadius ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <span className={isWithinRadius ? 'text-green-500' : 'text-red-500'}>
                          {isWithinRadius
                            ? 'You are within the attendance area'
                            : `You are ${distance ? Math.round(distance - selectedSession.radius) : 0}m outside the attendance area`}
                        </span>
                      </div>
                      {distance !== null && (
                        <p className="text-sm text-muted-foreground">
                          Distance from center: {Math.round(distance)}m (Allowed: {selectedSession.radius}m)
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-yellow-500">
                      <AlertCircle className="h-5 w-5" />
                      Location access required
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Enter Attendance Code</CardTitle>
                  <CardDescription>
                    Enter the 6-digit code displayed by your instructor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="code">6-Digit Code</Label>
                    <Input
                      id="code"
                      type="text"
                      maxLength={6}
                      placeholder="000000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      className="text-center text-2xl tracking-widest font-mono"
                      disabled={submitting}
                    />
                  </div>
                </CardContent>
              </Card>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  submitting ||
                  !isWithinRadius ||
                  code.length !== 6
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Marking Attendance...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Attendance
                  </>
                )}
              </Button>
            </>
          )}
        </form>
      )}
    </div>
  );
}
