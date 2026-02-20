import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/contexts/AuthContextSupabase';
import { LoadingScreen } from '@/components/Loading';

interface RequireAuthProps {
  children: React.ReactNode;
}

export function RequireAuth({ children }: RequireAuthProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

interface RequireRoleProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallbackPath?: string;
}

export function RequireRole({ children, allowedRoles, fallbackPath = '/dashboard' }: RequireRoleProps) {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!role || !allowedRoles.includes(role)) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

interface RequireOwnerProps {
  children: React.ReactNode;
}

export function RequireOwner({ children }: RequireOwnerProps) {
  return <RequireRole allowedRoles={['owner']}>{children}</RequireRole>;
}

interface RequireDoctorProps {
  children: React.ReactNode;
}

export function RequireDoctor({ children }: RequireDoctorProps) {
  return <RequireRole allowedRoles={['owner', 'doctor']}>{children}</RequireRole>;
}

interface RequireStudentProps {
  children: React.ReactNode;
}

export function RequireStudent({ children }: RequireStudentProps) {
  return <RequireRole allowedRoles={['student']}>{children}</RequireRole>;
}

interface RedirectIfAuthProps {
  children: React.ReactNode;
  redirectPath?: string;
}

export function RedirectIfAuth({ children, redirectPath = '/dashboard' }: RedirectIfAuthProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
