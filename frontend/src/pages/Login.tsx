import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Sparkles } from 'lucide-react';
import { Button, Card, Field, Input, Alert } from '../components/ui';
import { useAuth } from '../hooks/useAuth';
import { errMsg } from '../api/client';

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ville-50 to-slate-100 p-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-ville-500 text-white">
            <Sparkles size={22} aria-hidden />
          </div>
          <h1 className="text-xl font-semibold">IAmbassadeurs</h1>
          <p className="mt-1 text-sm text-slate-500">
            Plateforme collaborative — Charte Éthique IA, Ville d’Ivry-sur-Seine
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Identifiant Ville">
            <Input autoFocus value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
          </Field>
          <Field label="Mot de passe">
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <Alert kind="error">{error}</Alert>}
          <Button type="submit" disabled={busy} className="w-full justify-center">
            <LogIn size={16} aria-hidden /> {busy ? 'Connexion…' : 'Se connecter'}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">
          Authentification via Active Directory (API centrale APM).
        </p>
      </Card>
    </div>
  );
}
