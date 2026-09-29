import { useState } from 'react';
import { StitchAlert } from './stitch';
import { errMsg } from '../api/client';
import type { AiResult } from '../types';

// Panneau de synthèse IA : toujours identifié comme généré par IA.
export default function AiPanel({ label, run }: { label: string; run: () => Promise<AiResult> }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState('');

  async function executer() {
    setLoading(true); setError('');
    try {
      setResult(await run());
    } catch (e) {
      setError(errMsg(e, "L'IA est momentanément indisponible. Réessayez plus tard."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl bg-surface-container-low p-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[20px]">auto_awesome</span>
          <span className="font-headline text-headline-sm text-primary font-bold">{label}</span>
          <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full font-headline text-label-sm">Modèle souverain local</span>
        </div>
        <button
          className="flex items-center gap-1.5 px-3.5 py-1.5 bg-secondary hover:bg-secondary-container text-on-secondary rounded-full font-headline text-label-md shadow-sm transition-all disabled:opacity-50"
          onClick={executer} disabled={loading} type="button"
        >
          <span className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}>{loading ? 'sync' : result ? 'refresh' : 'auto_awesome'}</span>
          <span>{loading ? 'Génération…' : result ? 'Relancer' : 'Générer'}</span>
        </button>
      </div>
      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {result && (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap font-body text-body-sm text-on-surface leading-relaxed">{result.response}</p>
          <p className="font-body text-body-sm text-secondary">
            Contenu généré par IA{result.model_name ? ` (${result.model_name})` : ''} — à vérifier.
          </p>
        </div>
      )}
    </div>
  );
}
