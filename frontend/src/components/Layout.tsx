import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const navCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 font-headline text-label-md rounded-full transition-colors whitespace-nowrap ${
    isActive
      ? 'bg-primary-container text-on-primary-container font-bold'
      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
  }`;

// En-tête fixe type maquette Stitch : logo, nav horizontale, actions, avatar.
export default function Layout() {
  const { user, logout, isAdmin, isIanimateur, canInteract } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
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
          <NavLink to="/" className="flex items-center gap-3 shrink-0">
            <img alt="Logo IAmbassadeurs Ivry" className="h-8 w-auto object-contain" src="/logo.svg" />
            <div className="hidden sm:flex flex-col">
              <span className="font-headline text-headline-sm text-primary leading-tight tracking-tight">IAmbassadeurs</span>
              <span className="font-headline text-label-sm text-outline tracking-wider uppercase">Ville d'Ivry-sur-Seine</span>
            </div>
          </NavLink>

          <nav className="hidden lg:flex items-center gap-1 shrink-0" aria-label="Navigation principale">
            <NavLink to="/" end className={navCls}>Accueil</NavLink>
            <NavLink to="/ressources" className={navCls}>Base documentaire</NavLink>
            <NavLink to="/experimentations" className={navCls}>Expérimentations</NavLink>
            <NavLink to="/risques" className={navCls}>Gestion des risques</NavLink>
            <NavLink to="/votes" className={navCls}>Votes &amp; Consultations</NavLink>
            <NavLink to="/cartographie" className={navCls}>Cartographie</NavLink>
            {isIanimateur && <NavLink to="/analyse" className={navCls}>Analyse</NavLink>}
            {isAdmin && <NavLink to="/admin" className={navCls}>Administration</NavLink>}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {user?.roles?.[0] && (
              <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 bg-primary-fixed/50 rounded-full">
                <span className="w-2 h-2 rounded-full bg-secondary" />
                <span className="font-headline text-label-sm text-on-primary-fixed-variant truncate max-w-[190px]">
                  {user.roles.join(', ')}
                </span>
              </div>
            )}
            {canInteract && (
              <button
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary hover:bg-secondary-container text-on-secondary rounded-full font-headline text-label-md shadow-sm transition-all"
                type="button"
                onClick={() => navigate('/')}
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
                <span className="font-headline text-label-md text-on-primary">{initials}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-lowest rounded-xl shadow-modal border border-surface-container py-2">
                  <div className="px-4 py-2 border-b border-surface-container">
                    <div className="font-headline text-label-lg text-on-surface truncate">{user?.display_name}</div>
                    <div className="font-body text-body-sm text-on-surface-variant truncate">
                      {user?.roles?.length ? user.roles.join(', ') : 'Lecteur'}
                    </div>
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
        {/* Navigation mobile : défilement horizontal sous l'en-tête */}
        <nav className="lg:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto" aria-label="Navigation mobile">
          <NavLink to="/" end className={navCls}>Accueil</NavLink>
          <NavLink to="/ressources" className={navCls}>Base documentaire</NavLink>
          <NavLink to="/experimentations" className={navCls}>Expérimentations</NavLink>
          <NavLink to="/risques" className={navCls}>Risques</NavLink>
          <NavLink to="/votes" className={navCls}>Votes</NavLink>
          <NavLink to="/cartographie" className={navCls}>Cartographie</NavLink>
          {isIanimateur && <NavLink to="/analyse" className={navCls}>Analyse</NavLink>}
          {isAdmin && <NavLink to="/admin" className={navCls}>Admin</NavLink>}
        </nav>
      </header>
      <main className="pt-16 lg:pt-16 max-lg:pt-[6.5rem] min-h-screen">
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
            <p>© 2026 Direction de la Transformation Numérique &amp; Citoyenneté • Ivry-sur-Seine</p>
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
