import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BookOpen, FlaskConical, ShieldAlert, Vote, Network, User as UserIcon,
  Settings, BarChart3, LogOut, Home,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const linkCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
    isActive ? 'bg-ville-500 text-white' : 'text-slate-600 hover:bg-slate-100'
  }`;

export default function Layout() {
  const { user, logout, isAdmin, isIanimateur } = useAuth();
  const navigate = useNavigate();

  const links = [
    { to: '/', label: 'Accueil', icon: Home, end: true },
    { to: '/ressources', label: 'Base documentaire', icon: BookOpen },
    { to: '/experimentations', label: 'Expérimentations', icon: FlaskConical },
    { to: '/risques', label: 'Gestion des risques', icon: ShieldAlert },
    { to: '/votes', label: 'Vote', icon: Vote },
    { to: '/cartographie', label: 'Cartographie', icon: Network },
    ...(isIanimateur ? [{ to: '/analyse', label: 'Analyse', icon: BarChart3 }] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Admin', icon: Settings }] : []),
    { to: '/compte', label: 'Mon compte', icon: UserIcon },
  ];

  return (
    <div className="min-h-screen lg:flex">
      <aside className="no-print w-full border-b border-slate-200 bg-white lg:h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r lg:sticky lg:top-0 lg:flex lg:flex-col">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ville-500 text-sm font-bold text-white">IA</div>
            <div>
              <div className="text-sm font-semibold leading-tight">IAmbassadeurs</div>
              <div className="text-xs text-slate-500">Charte Éthique IA</div>
            </div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 px-3 pb-3 lg:flex-col lg:overflow-y-auto" aria-label="Navigation principale">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={linkCls}>
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto border-t border-slate-200 p-3">
          <div className="mb-2 px-1">
            <div className="truncate text-sm font-medium">{user?.display_name}</div>
            <div className="truncate text-xs text-slate-500">
              {user?.roles?.length ? user.roles.join(', ') : 'Lecteur'}
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            <LogOut size={16} aria-hidden /> Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 lg:p-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
