import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { errMsg } from '../api/client';
import { StitchAlert } from '../components/stitch';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(errMsg(err, 'Connexion impossible'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-surface-container-low p-4 overflow-hidden">
      <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-secondary-fixed/30 blur-3xl pointer-events-none" />
      <div className="absolute -left-16 -bottom-24 w-80 h-80 rounded-full bg-tertiary-fixed/20 blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-modal p-8 space-y-6">
        <div className="text-center space-y-3">
          <img src="/logo.svg" alt="IAmbassadeurs — Ville d'Ivry-sur-Seine" className="mx-auto h-14 w-auto" />
          <p className="font-body text-body-sm text-on-surface-variant">
            Plateforme collaborative de co-construction de la Charte Éthique IA
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="block font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">Identifiant Ville</span>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">person</span>
              <input
                autoFocus value={username} onChange={(e) => setUsername(e.target.value)}
                autoComplete="username" required
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-xl font-body text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/20 transition-all"
                placeholder="p.dupont"
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="block font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">Mot de passe</span>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">lock</span>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password" required
                className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low rounded-xl font-body text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-secondary/20 transition-all"
                placeholder="••••••••"
              />
            </div>
          </label>
          {error && <StitchAlert kind="error">{error}</StitchAlert>}
          <button
            type="submit" disabled={busy}
            className="w-full py-3 bg-secondary hover:bg-secondary-container text-on-secondary rounded-full font-headline text-label-lg shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-center font-body text-body-sm text-outline flex items-center justify-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">domain</span>
          Authentification via Active Directory (API centrale APM)
        </p>
      </div>
    </div>
  );
}
