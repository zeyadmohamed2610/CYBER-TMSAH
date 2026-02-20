import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContextSupabase';
import { supabase } from '@/config/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  Calendar, 
  AlertTriangle, 
  Activity,
  Shield,
  Clock,
  Mail,
  Loader2,
  CheckCircle,
  XCircle,
  Key
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  usersByRole: Record<string, number>;
  totalSessions: number;
  activeSessions: number;
  totalAttendance: number;
  attendanceBySubject: Record<string, number>;
  unresolvedAlerts: number;
}

interface SystemLog {
  id: string;
  type: string;
  uid?: string;
  email?: string;
  ip?: string;
  severity: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  student_id?: string;
  locked_until?: string;
  created_at: string;
}

export default function OwnerDashboard() {
  const { userProfile, logout } = useAuth();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchStats = useCallback(async () => {
    try {
      const { data: usersData } = await supabase.from('users').select('*');
      const { data: sessionsData } = await supabase.from('sessions').select('*');
      const { data: attendanceData } = await supabase.from('attendance').select('*');
      const { data: alertsData } = await supabase.from('alerts').select('*').eq('resolved', false);

      const usersByRole: Record<string, number> = { owner: 0, doctor: 0, student: 0 };
      usersData?.forEach(user => {
        if (usersByRole[user.role] !== undefined) {
          usersByRole[user.role]++;
        }
      });

      const activeSessions = sessionsData?.filter(s => s.is_active).length || 0;

      setStats({
        totalUsers: usersData?.length || 0,
        usersByRole,
        totalSessions: sessionsData?.length || 0,
        activeSessions,
        totalAttendance: attendanceData?.length || 0,
        attendanceBySubject: {},
        unresolvedAlerts: alertsData?.length || 0
      });
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchStats(), fetchUsers(), fetchLogs()]);
  }, [fetchStats, fetchUsers, fetchLogs]);

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'error': return 'bg-orange-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'login_success':
      case 'login_failure':
        return <Key className="h-4 w-4" />;
      case 'attendance_marked':
      case 'attendance_failed':
        return <CheckCircle className="h-4 w-4" />;
      case 'suspicious_activity':
        return <AlertTriangle className="h-4 w-4" />;
      case 'session_created':
      case 'session_ended':
        return <Calendar className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Owner Dashboard
            </h1>
            <p className="text-muted-foreground">System Administration</p>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="text-primary border-primary">
              Owner Access
            </Badge>
            <Button variant="outline" onClick={logout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="logs">System Logs</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats?.usersByRole.doctor || 0} doctors, {stats?.usersByRole.student || 0} students
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {stats?.activeSessions || 0} currently active
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.totalAttendance || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    records marked
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Alerts</CardTitle>
                  <AlertTriangle className={`h-4 w-4 ${stats?.unresolvedAlerts ? 'text-red-500' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${stats?.unresolvedAlerts ? 'text-red-500' : ''}`}>
                    {stats?.unresolvedAlerts || 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    unresolved alerts
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {logs.slice(0, 5).map((log) => (
                    <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                      <div className={`p-1 rounded ${getSeverityColor(log.severity)} text-white`}>
                        {getTypeIcon(log.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{log.type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.email || log.uid || 'System'} • {formatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Users by Role</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Owners</span>
                      <Badge>{stats?.usersByRole.owner || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Doctors</span>
                      <Badge variant="secondary">{stats?.usersByRole.doctor || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Students</span>
                      <Badge variant="outline">{stats?.usersByRole.student || 0}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Registered Users</CardTitle>
                <CardDescription>View and manage all registered users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Email</th>
                        <th className="text-left py-3 px-4">Role</th>
                        <th className="text-left py-3 px-4">Student ID</th>
                        <th className="text-left py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-4">{user.name}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              {user.email}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={user.role === 'owner' ? 'default' : user.role === 'doctor' ? 'secondary' : 'outline'}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">{user.student_id || '-'}</td>
                          <td className="py-3 px-4">
                            {user.locked_until && new Date(user.locked_until) > new Date() ? (
                              <span className="flex items-center gap-1 text-red-500 text-sm">
                                <XCircle className="h-4 w-4" />
                                Locked
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-green-500 text-sm">
                                <CheckCircle className="h-4 w-4" />
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>System Logs</CardTitle>
                <CardDescription>All system activity and events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="p-4 rounded-lg border bg-card flex items-start gap-4">
                      <div className={`p-2 rounded ${getSeverityColor(log.severity)} text-white shrink-0`}>
                        {getTypeIcon(log.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium capitalize">{log.type.replace(/_/g, ' ')}</span>
                          <Badge variant="outline" className="text-xs">{log.severity}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {log.email || log.uid || 'System'} • IP: {log.ip || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Suspicious activity and critical events</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.unresolvedAlerts ? (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      There are {stats.unresolvedAlerts} unresolved security alerts that require attention.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No unresolved alerts</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
