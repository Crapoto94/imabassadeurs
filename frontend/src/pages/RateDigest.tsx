import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { API_URL } from '../api/client';

// Notation d'un digest sans authentification : le token du lien fait foi.
export default function RateDigest() {
  const { token } = useParams();
  const [params] = useSearchParams();
  const note = params.get('note');
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    fetch(`${API_URL}/api/v1/digest/rate/${token}?note=${note}`)
      .then((r) => setState(r.ok ? 'ok' : 'error'))
      .catch(() => setState('error'));
  }, [token, note]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow">
        {state === 'loading' && <p>Enregistrement de votre note…</p>}
        {state === 'ok' && <><h1 className="text-xl font-semibold text-emerald-600">Merci !</h1><p className="mt-2 text-sm text-slate-600">Votre évaluation du résumé a bien été enregistrée.</p></>}
        {state === 'error' && <><h1 className="text-xl font-semibold text-red-600">Lien invalide</h1><p className="mt-2 text-sm text-slate-600">Ce lien de notation est invalide ou a déjà été utilisé.</p></>}
      </div>
    </div>
  );
}
