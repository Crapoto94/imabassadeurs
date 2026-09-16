import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';

// Garde de route par rôle : masque Admin et Analyse, redirige vers /login si non connecté.
export default function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, hasRole, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && roles.length && !isAdmin && !hasRole(...roles)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
