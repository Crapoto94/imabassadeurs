import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Avatar } from './stitch';
import { useGamification } from '../hooks/useGamification';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-2.5 py-1.5 font-headline text-label-md rounded-full transition-colors whitespace-nowrap ${
    isActive
      ? 'bg-primary-container text-on-primary-container font-bold'
      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
  }`;

const mobileNavCls = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-4 py-3 rounded-xl font-headline text-label-lg transition-colors ${
    isActive
      ? 'bg-primary-container text-on-primary-container font-bold'
      : 'text-on-surface-variant hover:bg-surface-container'
  }`;

// En-tête fixe type maquette Stitch : logo, nav horizontale, actions, avatar.
export default function Layout() {
  const { user, logout, isAdmin, isIanimateur, canInteract } = useAuth();
  const { summary } = useGamification();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); setNavOpen(false); }, [location.pathname]);
  // Bloque le défilement de la page derrière le menu mobile ouvert.
  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

  const links = [
    { to: '/', label: 'Accueil', icon: 'home', end: true, show: true },
    { to: '/ressources', label: 'Base documentaire', icon: 'library_books', show: true },
    { to: '/experimentations', label: 'Expérimentations', icon: 'science', show: true },
    { to: '/risques', label: 'Risques', icon: 'warning', show: true },
    { to: '/votes', label: 'Votes', icon: 'how_to_vote', show: true },
    { to: '/cartographie', label: 'Cartographie', icon: 'hub', show: true },
    { to: '/analyse', label: 'Analyse', icon: 'analytics', show: isIanimateur },
    { to: '/admin', label: 'Admin', icon: 'admin_panel_settings', show: isAdmin },
  ].filter((l) => l.show);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = (user?.display_name || '?')
    .split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface">
      <header className="no-print fixed top-0 inset-x-0 z-50 bg-surface-container-lowest/95 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 w-full px-4 lg:px-6 flex items-center justify-between gap-3">
          <button
            aria-controls="mobile-nav"
            aria-expanded={navOpen}
            aria-label={navOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            className="xl:hidden -ml-2 w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
            type="button"
            onClick={() => setNavOpen((v) => !v)}
          >
            <span className="material-symbols-outlined">{navOpen ? 'close' : 'menu'}</span>
          </button>
          <NavLink to="/" className="flex items-center gap-3 shrink-0 mr-auto xl:mr-0">
            <img alt="Logo IAmbassadeurs Ivry" className="h-8 w-auto object-contain" src="/logo.svg" />
            <div className="hidden sm:flex flex-col">
              <span className="font-headline text-headline-sm text-primary leading-tight tracking-tight">IAmbassadeurs</span>
              <span className="font-headline text-label-sm text-outline tracking-wider uppercase">Ville d'Ivry-sur-Seine</span>
            </div>
          </NavLink>

          <nav className="hidden xl:flex items-center gap-0.5 shrink-0" aria-label="Navigation principale">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={navCls}>{l.label}</NavLink>)}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {summary?.enabled && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-tertiary-fixed/40 rounded-full">
                <span className="material-symbols-outlined text-[14px] text-on-tertiary-fixed-variant">bolt</span>
                <span className="font-headline text-label-sm text-on-tertiary-fixed-variant whitespace-nowrap">
                  {summary.level_label} · {summary.points} pts
                </span>
              </div>
            )}
            {canInteract && (
              <button
                className="hidden xl:flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary hover:bg-secondary-container text-on-secondary rounded-full font-headline text-label-md shadow-sm transition-all"
                type="button"
                onClick={() => navigate('/', { state: { openComposer: true } })}
              >
                <span className="material-symbols-outlined text-[16px]">add_circle</span>
                <span>Contribuer</span>
              </button>
            )}
            <div className="relative" ref={menuRef}>
              <button
                aria-label="Menu du compte"
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0"
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {user?.avatar_v
                  ? <Avatar name={user.display_name} size={32} userId={user.id} v={user.avatar_v} />
                  : <span className="font-headline text-label-md text-on-primary">{initials}</span>}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-modal border border-surface-container py-2">
                  <div className="px-4 py-2 border-b border-surface-container">
                    <div className="font-headline text-label-lg text-on-surface truncate">{user?.display_name}</div>
                    <div className="font-body text-body-sm text-on-surface-variant truncate">
                      {user?.roles?.length ? user.roles.join(', ') : 'Lecteur'}
                    </div>
                    {summary?.enabled && (
                      <div className="font-headline text-label-sm text-tertiary mt-0.5">
                        {summary.level_label} · {summary.points} pts
                      </div>
                    )}
                  </div>
                  <NavLink to="/compte" className="flex items-center gap-2 px-4 py-2 font-body text-body-md text-on-surface-variant hover:bg-surface-container">
                    <span className="material-symbols-outlined text-[18px]">person</span> Mon compte
                  </NavLink>
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 font-body text-body-md text-on-surface-variant hover:bg-surface-container"
                    onClick={() => { logout(); navigate('/login'); }}
                  >
                    <span className="material-symbols-outlined text-[18px]">logout</span> Se déconnecter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Navigation mobile : panneau déroulant sous l'en-tête */}
        {navOpen && (
          <>
            <div className="xl:hidden fixed inset-0 top-16 bg-black/30" onClick={() => setNavOpen(false)} aria-hidden="true" />
            <nav
              id="mobile-nav"
              aria-label="Navigation mobile"
              className="xl:hidden absolute inset-x-0 top-16 max-h-[calc(100vh-4rem)] overflow-y-auto bg-surface-container-lowest border-t border-surface-container shadow-modal p-3 flex flex-col gap-1"
            >
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.end} className={mobileNavCls}>
                  <span className="material-symbols-outlined text-[20px]">{l.icon}</span>
                  {l.label}
                </NavLink>
              ))}
              {canInteract && (
                <button
                  className="mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-on-secondary rounded-full font-headline text-label-lg shadow-sm"
                  type="button"
                  onClick={() => { setNavOpen(false); navigate('/', { state: { openComposer: true } }); }}
                >
                  <span className="material-symbols-outlined text-[18px]">add_circle</span> Contribuer
                </button>
              )}
            </nav>
          </>
        )}
      </header>
      <main className="pt-16 min-h-screen">
        <Outlet />
      </main>
      <footer className="no-print w-full bg-surface-container-low mt-auto py-10 shadow-[0_-1px_6px_rgba(0,0,0,0.02)]">
        <div className="w-full max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6">
            <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
              <div className="flex items-center gap-2">
                <span className="font-headline text-headline-sm text-primary tracking-tight">Ville d'Ivry-sur-Seine</span>
                <span className="font-headline text-label-sm text-outline px-2 py-0.5 bg-surface-container rounded-full">Civic Tech &amp; IA Éthique</span>
              </div>
              <p className="font-body text-body-sm text-on-surface-variant">Plateforme collaborative municipale de co-construction de la Charte Éthique de l'IA.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-6 font-body text-body-sm text-outline">
            <p>© 2026 Ivry-sur-Seine</p>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
              <span className="font-headline text-label-sm text-on-surface-variant">Réseau d'agents IAmbassadeurs actif</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
