import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContextSupabase';
import { useAttendance } from '@/hooks/useAttendance';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  QrCode,
  TrendingUp,
  BookOpen,
  Loader2
} from 'lucide-react';

interface AttendanceRecord {
  id: string;
  session_id: string;
  subject_id: string;
  subject_name: string;
  timestamp: string;
  distance_from_center: number;
  verified: boolean;
}

export default function StudentDashboard() {
  const { userProfile, logout } = useAuth();
  const { getStudentHistory } = useAttendance();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, bySubject: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const history = await getStudentHistory(50);
        setRecords(history || []);
        
        const bySubject: Record<string, number> = {};
        (history || []).forEach(r => {
          bySubject[r.subject_name] = (bySubject[r.subject_name] || 0) + 1;
        });
        setStats({ total: (history || []).length, bySubject });
      } catch (err) {
        console.error('Error fetching history:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHistory();
  }, [getStudentHistory]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">Student Dashboard</h1>
            <p className="text-muted-foreground">Welcome, {userProfile?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/attendance/mark">
              <Button className="bg-gradient-to-r from-primary to-cyan-500">
                <QrCode className="h-4 w-4 mr-2" />
                Mark Attendance
              </Button>
            </Link>
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
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Attendance marked</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subjects</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{Object.keys(stats.bySubject).length}</div>
              <p className="text-xs text-muted-foreground">Different subjects</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last Attendance</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {records[0] ? formatDate(records[0].timestamp).split(',')[0] : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {records[0] ? records[0].subject_name : 'No records yet'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-green-500">Active</div>
              <p className="text-xs text-muted-foreground">Student ID: {userProfile?.student_id || 'N/A'}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Attendance History</CardTitle>
              <CardDescription>Your recent attendance records</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : records.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No attendance records yet. Mark your first attendance!
                </div>
              ) : (
                <div className="space-y-4">
                  {records.slice(0, 10).map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${record.verified ? 'bg-green-100' : 'bg-red-100'}`}>
                          {record.verified ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{record.subject_name}</p>
                          <p className="text-sm text-muted-foreground">{record.subject_id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatDate(record.timestamp)}</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(record.distance_from_center)}m from center
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>By Subject</CardTitle>
              <CardDescription>Attendance breakdown by subject</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.bySubject).length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No data yet</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(stats.bySubject).map(([subject, count]) => (
                    <div key={subject} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="truncate pr-2">{subject}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                      <Progress 
                        value={(count / stats.total) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
