import { useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button, Alert, Spinner } from './ui';
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
    <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-purple-900">
          <Sparkles size={16} aria-hidden /> {label}
        </div>
        <Button variant="secondary" onClick={executer} disabled={loading}>
          {loading ? <Spinner /> : result ? <RefreshCw size={16} /> : <Sparkles size={16} />}
          {result ? 'Relancer' : 'Générer'}
        </Button>
      </div>
      {error && <div className="mt-3"><Alert kind="error">{error}</Alert></div>}
      {result && (
        <div className="mt-3 space-y-2">
          <p className="whitespace-pre-wrap text-sm text-slate-800">{result.response}</p>
          <p className="text-xs text-purple-700">
            Contenu généré par IA{result.model_name ? ` (${result.model_name})` : ''} — à vérifier.
          </p>
        </div>
      )}
    </div>
  );
}
