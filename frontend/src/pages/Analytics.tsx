import { useEffect, useMemo, useState } from 'react';
import { getActivity, getConsensus, getDigestQuality, getInteractions, getKpis, getStats } from '../api/endpoints';
import { errMsg } from '../api/client';
import {
  GhostButton, PrimaryButton, ProgressBar, SectionCard, StitchAlert, StitchField, StitchInput, StitchSpinner,
} from '../components/stitch';

function TableStitch({ titles, rows }: { titles: string[]; rows: any[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-body text-body-sm">
        <thead>
          <tr className="border-b border-surface-container text-label-sm uppercase text-outline font-headline">
            {titles.map((t) => <th key={t} className="px-2 py-2">{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={titles.length} className="px-2 py-4 text-outline">Aucune donnée.</td></tr>}
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-surface-container-low hover:bg-surface-container-low/50 transition-colors">
              {r.map((c, j) => <td key={j} className="px-2 py-2 text-on-surface-variant">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Analytics() {
  const [kpis, setKpis] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [digests, setDigests] = useState<any[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [consensus, setConsensus] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError('');
    try {
      const [k, a, i, d, s] = await Promise.all([
        getKpis(),
        getActivity({ from: from || undefined, to: to || undefined }),
        getInteractions({ from: from || undefined, to: to || undefined }),
        getDigestQuality(),
        getStats().catch(() => null),
      ]);
      setKpis(k); setActivity(a); setInteractions(i); setDigests(d); setStats(s);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function runConsensus() {
    setBusy(true); setError('');
    try { setConsensus(await getConsensus()); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }

  const digestAvg = useMemo(() => {
    const rated = digests.filter((d) => (d.moyenne ?? d.note_moyenne) != null);
    if (!rated.length) return null;
    const sum = rated.reduce((acc, d) => acc + Number(d.moyenne ?? d.note_moyenne), 0);
    return sum / rated.length;
  }, [digests]);

  const dynamicTotal = kpis ? (kpis.comments || 0) + (kpis.resources || 0) + (kpis.risks || 0) + (kpis.vote_sessions || 0) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* En-tête accrédité */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-container-lowest p-6 rounded-2xl shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-surface-container rounded-full text-secondary font-headline text-label-sm">
              <span className="material-symbols-outlined text-[14px]">shield_person</span>
              Espace Accrédité
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-tertiary-container/10 text-tertiary font-headline text-label-sm rounded-full">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              Supervision Opérationnelle Active
            </span>
          </div>
          <h1 className="font-headline text-headline-xl-mobile lg:text-headline-xl text-primary tracking-tight">Tableau de bord d'animation — Démarche Charte Éthique IA Ivry</h1>
          <p className="font-body text-body-md text-on-surface-variant max-w-3xl">
            Pilotage continu des délibérations, suivi de l'acculturation des agents et analyse automatisée du consensus communal en vue de l'adoption par le Conseil Municipal.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <PrimaryButton icon="psychology" onClick={runConsensus} disabled={busy} className="!rounded-lg">
            {busy ? 'Analyse en cours…' : 'Exécuter consensus_analysis'}
          </PrimaryButton>
        </div>
      </div>

      {error && <StitchAlert kind="error">{error}</StitchAlert>}
      {loading ? <StitchSpinner /> : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card flex flex-col justify-between hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed/40 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-[24px]">group</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="font-headline text-headline-xl text-primary font-bold tracking-tight">{kpis?.users_active ?? 0}</div>
                <div className="font-headline text-label-md text-on-surface font-semibold mt-0.5">Mobilisation des agents</div>
                <div className="font-body text-body-sm text-outline mt-1">Agents actifs sur {kpis?.users_total ?? 0} comptes</div>
              </div>
              <div className="mt-4">
                <ProgressBar value={kpis?.participation_rate || 0} />
                <p className="font-headline text-label-sm text-outline mt-1">{kpis?.participation_rate ?? 0}% de participation</p>
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card flex flex-col justify-between hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-secondary-fixed/50 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[24px]">forum</span>
                </div>
                <span className="font-headline text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">Temps réel</span>
              </div>
              <div className="mt-4">
                <div className="font-headline text-headline-xl text-primary font-bold tracking-tight">{dynamicTotal}</div>
                <div className="font-headline text-label-md text-on-surface font-semibold mt-0.5">Dynamique participative</div>
                <div className="font-body text-body-sm text-on-surface-variant flex items-center gap-1.5 flex-wrap mt-1">
                  <span>{kpis?.comments ?? 0} coms</span><span>•</span>
                  <span>{kpis?.resources ?? 0} docs</span><span>•</span>
                  <span className="text-error font-medium">{kpis?.risks ?? 0} risques</span><span>•</span>
                  <span className="text-secondary font-medium">{kpis?.vote_sessions ?? 0} scrutins</span>
                </div>
              </div>
              <div className="mt-4 flex gap-1 h-1.5 w-full rounded-full overflow-hidden">
                {dynamicTotal > 0 && (
                  <>
                    <div className="bg-secondary" style={{ width: `${(kpis.comments / dynamicTotal) * 100}%` }} title="Commentaires" />
                    <div className="bg-secondary-fixed-dim" style={{ width: `${(kpis.resources / dynamicTotal) * 100}%` }} title="Ressources" />
                    <div className="bg-error" style={{ width: `${(kpis.risks / dynamicTotal) * 100}%` }} title="Risques" />
                    <div className="bg-tertiary-fixed-dim" style={{ width: `${(kpis.vote_sessions / dynamicTotal) * 100}%` }} title="Votes" />
                  </>
                )}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card flex flex-col justify-between hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-primary-fixed flex items-center justify-center text-primary-container">
                  <span className="material-symbols-outlined text-[24px]">auto_awesome</span>
                </div>
                <span className="font-headline text-label-sm text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">notification_digests</span>
              </div>
              <div className="mt-4">
                <div className="flex items-baseline gap-1">
                  <span className="font-headline text-headline-xl text-primary font-bold tracking-tight">{digestAvg ? digestAvg.toFixed(1) : '—'}</span>
                  <span className="font-headline text-headline-sm text-outline">/ 5</span>
                </div>
                <div className="font-headline text-label-md text-on-surface font-semibold mt-0.5">Qualité des synthèses IA</div>
                <div className="font-body text-body-sm text-outline mt-1">Retours des e-mails récapitulatifs</div>
              </div>
              <div className="mt-4 flex items-center gap-1 text-secondary">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`material-symbols-outlined text-[16px] ${digestAvg && n <= Math.round(digestAvg) ? 'filled' : ''}`}>star</span>
                ))}
              </div>
            </div>

            <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-card flex flex-col justify-between hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-lg bg-tertiary-container/15 flex items-center justify-center text-tertiary">
                  <span className="material-symbols-outlined text-[24px]">balance</span>
                </div>
              </div>
              <div className="mt-4">
                <div className="font-headline text-headline-xl text-primary font-bold tracking-tight">{stats?.consensus_rate ?? 0}%</div>
                <div className="font-headline text-label-md text-on-surface font-semibold mt-0.5">Consensus global principes</div>
                <div className="font-body text-body-sm text-outline mt-1">{stats?.principles_adopted ?? 0} principe(s) adopté(s)</div>
              </div>
              <div className="mt-4">
                <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden">
                  <div className="bg-tertiary h-full rounded-full" style={{ width: `${stats?.consensus_rate ?? 0}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Filtres période */}
          <SectionCard className="p-4 flex flex-wrap items-end gap-3">
            <StitchField label="Du">
              <StitchInput type="date" className="!w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
            </StitchField>
            <StitchField label="Au">
              <StitchInput type="date" className="!w-44" value={to} onChange={(e) => setTo(e.target.value)} />
            </StitchField>
            <GhostButton icon="filter_alt" onClick={load}>Filtrer</GhostButton>
          </SectionCard>

          {/* Bento : activité + tops */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SectionCard className="p-6">
              <h2 className="font-headline text-headline-sm text-primary flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary text-[20px]">monitoring</span>
                Activité par utilisateur
              </h2>
              <TableStitch
                titles={['Utilisateur', 'Ress.', 'Comm.', 'Risques', 'Expé.', 'Votes']}
                rows={activity.map((a) => [a.display_name, a.resources, a.comments, a.risks, a.experiments, a.votes])}
              />
            </SectionCard>
            <SectionCard className="p-6">
              <h2 className="font-headline text-headline-sm text-primary flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary text-[20px]">diversity_3</span>
                Interactions (réponses à …)
              </h2>
              <TableStitch titles={['De', 'Vers', 'Réponses']} rows={interactions.map((i) => [i.from, i.to, i.replies])} />
            </SectionCard>
            <SectionCard className="p-6">
              <h2 className="font-headline text-headline-sm text-primary flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-secondary text-[20px]">star</span>
                Ressources les mieux notées
              </h2>
              <TableStitch titles={['Ressource', 'Note', 'Votes']} rows={(kpis?.top_resources || []).map((r: any) => [r.title, r.avg_stars, r.votes])} />
            </SectionCard>
            <SectionCard className="p-6">
              <h2 className="font-headline text-headline-sm text-primary flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-error text-[20px]">warning</span>
                Risques les plus qualifiés
              </h2>
              <TableStitch titles={['Risque', 'Imp.', 'Prob.']} rows={(kpis?.top_risks || []).map((r: any) => [r.title, r.importance, r.probability])} />
            </SectionCard>
          </div>

          <SectionCard className="p-6">
            <h2 className="font-headline text-headline-sm text-primary flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-secondary text-[20px]">mark_email_read</span>
              Qualité des résumés IA (digests)
            </h2>
            <TableStitch
              titles={['Période', 'Digests', 'Notés', 'Note moyenne']}
              rows={digests.map((d) => [d.period, d.digests, d.notes, d.moyenne ?? d.note_moyenne])}
            />
          </SectionCard>

          {/* Analyseur sémantique */}
          <SectionCard className="p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary-container text-on-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[28px]">insights</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-headline text-headline-md text-primary">Analyseur Sémantique IA de Consensus</h2>
                    <span className="px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant font-headline text-label-sm rounded-full">LLM local</span>
                  </div>
                  <p className="font-body text-body-sm text-on-surface-variant">Extraction automatique des convergences républicaines et des controverses d'usage</p>
                </div>
              </div>
              <PrimaryButton icon={busy ? 'sync' : 'play_arrow'} onClick={runConsensus} disabled={busy} className={busy ? 'animate-pulse' : ''}>
                {busy ? 'Inférence en cours…' : 'Lancer l\'analyse'}
              </PrimaryButton>
            </div>

            {consensus && (
              <div className="space-y-4">
                {consensus.parsed ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {consensus.parsed.consensus && (
                      <div className="bg-surface-container-low rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2 text-tertiary">
                          <span className="material-symbols-outlined text-[22px]">check_circle</span>
                          <h3 className="font-headline text-headline-sm text-tertiary">Points de consensus établis</h3>
                        </div>
                        {consensus.parsed.consensus.map((c: any, i: number) => (
                          <div key={i} className="bg-surface-container-lowest p-4 rounded-lg shadow-card">
                            <p className="font-body text-body-sm text-on-surface-variant">{typeof c === 'string' ? c : c.label || JSON.stringify(c)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {consensus.parsed.controverses && (
                      <div className="bg-surface-container-low rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-2 text-error">
                          <span className="material-symbols-outlined text-[22px]">warning</span>
                          <h3 className="font-headline text-headline-sm text-error">Controverses émergentes à arbitrer</h3>
                        </div>
                        {consensus.parsed.controverses.map((c: any, i: number) => (
                          <div key={i} className="bg-surface-container-lowest p-4 rounded-lg shadow-card">
                            <p className="font-body text-body-sm text-on-surface-variant">{typeof c === 'string' ? c : c.label || JSON.stringify(c)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap font-body text-body-md text-on-surface">{consensus.raw}</p>
                )}
                <p className="font-body text-body-sm text-secondary">Analyse générée par IA — à vérifier.</p>
              </div>
            )}
            {!consensus && !busy && (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <span className="material-symbols-outlined text-[40px] text-outline">insights</span>
                <p className="font-body text-body-md text-on-surface-variant max-w-md">
                  Lancez l'analyse sémantique pour extraire les points de consensus et les lignes de fracture du débat communal.
                </p>
              </div>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
