import { Link } from 'react-router-dom';
import { ProgressBar } from './stitch';
import type { GamificationSummary } from '../types';

// Contenu « Ma progression » réutilisable (page Mon compte + pop-up de l'en-tête).
// Ne rend ni carte ni titre : le conteneur (SectionCard / Modal) fournit le cadre.
export default function ProgressionPanel({ summary, onNavigate }: { summary: GamificationSummary; onNavigate?: () => void }) {
  return (
    <div>
      <p className="mb-4 font-body text-body-sm text-on-surface-variant">
        Vos contributions nourrissent la montée en compétence collective.
      </p>

      <div className="flex items-center gap-4 mb-4">
        <div className="text-center shrink-0">
          <span className="font-headline text-headline-xl text-primary">{summary.points}</span>
          <p className="font-headline text-label-sm text-outline uppercase">points</p>
        </div>
        <div className="flex-1">
          <ProgressBar value={summary.progress_pct} />
          <div className="mt-1 flex justify-between font-headline text-label-sm text-outline">
            <span>{summary.level_label}</span>
            <span>
              {summary.next_level_points != null
                ? `${summary.next_level_points - summary.points} pts avant le niveau ${summary.level + 1}`
                : 'Niveau maximal atteint'}
            </span>
          </div>
        </div>
      </div>

      {summary.next_steps.length > 0 && (
        <div className="mb-4 rounded-xl bg-secondary-fixed/40 p-3">
          <p className="mb-1 font-headline text-label-sm uppercase tracking-wider text-on-secondary-fixed-variant">
            Prochaine étape suggérée
          </p>
          <Link
            to={summary.next_steps[0].href}
            onClick={onNavigate}
            className="inline-flex items-center gap-2 font-headline text-label-md text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[18px]">{summary.next_steps[0].icon}</span>
            {summary.next_steps[0].label}
          </Link>
        </div>
      )}

      <div className="mb-4 space-y-2">
        <p className="font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">Vos 4 piliers</p>
        {summary.axes.map((a) => (
          <div key={a.key} className="flex items-center gap-3">
            <span className="w-28 shrink-0 font-headline text-label-sm text-on-surface">{a.label}</span>
            <ProgressBar value={a.points ? Math.min(100, Math.round((a.points / 750) * 100)) : 0} className="flex-1" />
            <span className="w-24 shrink-0 text-right font-headline text-label-sm text-outline">
              {a.points} pts · {a.level_label}
            </span>
          </div>
        ))}
      </div>

      {summary.impact_points > 0 && (
        <p className="mb-2 font-body text-body-sm text-on-surface-variant">
          <span className="font-headline text-label-sm text-tertiary">Points d'impact :</span>{' '}
          {summary.impact.filter((i) => i.count > 0).map((i) => `${i.label} (${i.count})`).join(' · ') || '—'}
        </p>
      )}

      {summary.parcours.total > 0 && (
        <div className="mb-4">
          <p className="mb-1 font-headline text-label-sm text-on-surface-variant uppercase tracking-wider">Parcours obligatoire</p>
          <div className="flex items-center gap-3">
            <ProgressBar value={summary.parcours.total ? Math.round((summary.parcours.lu / summary.parcours.total) * 100) : 0} />
            <span className="font-headline text-label-md text-on-surface whitespace-nowrap">
              {summary.parcours.lu}/{summary.parcours.total} lu(s)
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {summary.badges.map((b) => (
          <span
            key={b.key}
            title={`${b.label} (${b.current}/${b.target})`}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-headline text-label-sm ${
              b.earned
                ? 'bg-tertiary-fixed/50 text-on-tertiary-fixed-variant border-tertiary-fixed-dim/40'
                : 'bg-surface-container text-outline border-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{b.earned ? b.icon : 'lock'}</span>
            {b.label}
            <span className="text-[11px] opacity-80">{b.current}/{b.target}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
