import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContextSupabase';
import { useSessions } from '@/hooks/useAttendance';
import { supabase } from '@/config/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Calendar, 
  Users, 
  Clock, 
  QrCode,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle
} from 'lucide-react';

export default function DoctorDashboard() {
  const { userProfile, logout } = useAuth();
  const { sessions, loading, createSession, endSession, getActiveSessions } = useSessions();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQR, setShowQR] = useState<string | null>(null);
  const [qrData, setQRData] = useState<{ hash: string; expiresAt: number } | null>(null);

  const [newSession, setNewSession] = useState({
    subjectId: '',
    subjectName: '',
    startTime: '',
    endTime: '',
    locationLat: '',
    locationLng: '',
    radius: '50'
  });

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);

    try {
      await createSession({
        subjectId: newSession.subjectId,
        subjectName: newSession.subjectName,
        startTime: new Date(newSession.startTime),
        endTime: new Date(newSession.endTime),
        locationLat: parseFloat(newSession.locationLat),
        locationLng: parseFloat(newSession.locationLng),
        radius: parseInt(newSession.radius)
      });
      
      setNewSession({
        subjectId: '',
        subjectName: '',
        startTime: '',
        endTime: '',
        locationLat: '',
        locationLng: '',
        radius: '50'
      });
    } catch (err: any) {
      setError(err.message || 'Failed to create session');
    } finally {
      setCreating(false);
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await endSession(sessionId);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };

  const fetchQRCode = async (sessionId: string) => {
    try {
      const { data, error } = await supabase.rpc('generate_rotating_hash', { 
        p_session_id: sessionId 
      });

      if (error) throw error;

      if (data && data.length > 0) {
        setQRData({
          hash: data[0].hash,
          expiresAt: data[0].expires_at
        });
        setShowQR(sessionId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to get QR code');
    }
  };

  useEffect(() => {
    if (showQR) {
      const interval = setInterval(() => {
        fetchQRCode(showQR);
      }, 25000);
      return () => clearInterval(interval);
    }
  }, [showQR]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeRemaining = (expiresAt: number) => {
    const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
    return `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Doctor Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {userProfile?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-cyan-500">
                  <Plus className="h-4 w-4 mr-2" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Attendance Session</DialogTitle>
                  <DialogDescription>
                    Create a new attendance session for your students
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateSession} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="space-y-2">
                    <Label htmlFor="subjectId">Subject ID</Label>
                    <Input
                      id="subjectId"
                      value={newSession.subjectId}
                      onChange={(e) => setNewSession({ ...newSession, subjectId: e.target.value })}
                      placeholder="e.g., CS101"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="subjectName">Subject Name</Label>
                    <Input
                      id="subjectName"
                      value={newSession.subjectName}
                      onChange={(e) => setNewSession({ ...newSession, subjectName: e.target.value })}
                      placeholder="e.g., Introduction to Computer Science"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Start Time</Label>
                      <Input
                        id="startTime"
                        type="datetime-local"
                        value={newSession.startTime}
                        onChange={(e) => setNewSession({ ...newSession, startTime: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endTime">End Time</Label>
                      <Input
                        id="endTime"
                        type="datetime-local"
                        value={newSession.endTime}
                        onChange={(e) => setNewSession({ ...newSession, endTime: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="location">Location (Lat, Lng)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Latitude"
                        type="number"
                        step="any"
                        value={newSession.locationLat}
                        onChange={(e) => setNewSession({ ...newSession, locationLat: e.target.value })}
                        required
                      />
                      <Input
                        placeholder="Longitude"
                        type="number"
                        step="any"
                        value={newSession.locationLng}
                        onChange={(e) => setNewSession({ ...newSession, locationLng: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="radius">Radius (meters)</Label>
                    <Input
                      id="radius"
                      type="number"
                      min="1"
                      max="1000"
                      value={newSession.radius}
                      onChange={(e) => setNewSession({ ...newSession, radius: e.target.value })}
                      required
                    />
                  </div>
                  
                  <DialogFooter>
                    <Button type="submit" disabled={creating}>
                      {creating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        'Create Session'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessions.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sessions.filter(s => s.is_active).length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sessions.reduce((sum, s) => sum + (s.attendance_count || 0), 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sessions.length > 0
                  ? Math.round(sessions.reduce((sum, s) => sum + (s.attendance_count || 0), 0) / sessions.length)
                  : 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Sessions</CardTitle>
            <CardDescription>Manage your attendance sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sessions yet. Create your first session!
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-medium">{session.subject_name}</h3>
                        <p className="text-sm text-muted-foreground">{session.subject_id}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.is_active ? (
                          <span className="flex items-center gap-1 text-sm text-green-500">
                            <CheckCircle className="h-4 w-4" />
                            Active
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            Ended
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                      <div>
                        <p className="text-muted-foreground">Start</p>
                        <p className="font-medium">{formatTime(session.start_time)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">End</p>
                        <p className="font-medium">{formatTime(session.end_time)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Attendance</p>
                        <p className="font-medium">{session.attendance_count || 0} students</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Radius</p>
                        <p className="font-medium">{session.radius}m</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {session.is_active && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fetchQRCode(session.id)}
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            Show Code
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleEndSession(session.id)}
                          >
                            End Session
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {showQR && qrData && (
        <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Attendance Code</DialogTitle>
              <DialogDescription>
                Share this code with your students. It rotates every 30 seconds.
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-6">
              <div className="text-6xl font-mono font-bold tracking-widest text-primary mb-4">
                {qrData.hash}
              </div>
              <div className="text-sm text-muted-foreground mb-2">
                Time remaining: {getTimeRemaining(qrData.expiresAt)}
              </div>
              <Progress 
                value={((qrData.expiresAt - Date.now()) / 30000) * 100} 
                className="h-2"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
