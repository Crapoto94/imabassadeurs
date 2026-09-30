import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addVoteOption, castVote, createVote, getVotes } from '../api/endpoints';
import { errMsg } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import {
  Avatar, Modal, PrimaryButton, ProgressBar, SectionCard, StitchAlert, StitchEmpty, StitchField,
  StitchInput, StitchSelect, StitchSpinner, StitchTextarea, useToast,
} from '../components/stitch';
import type { VoteSession } from '../types';

function VoteSessionCard({ session, onChanged }: { session: VoteSession; onChanged: () => void }) {
  const { canInteract } = useAuth();
  const { show, Toast } = useToast();
  const [writeIn, setWriteIn] = useState('');
  const [busy, setBusy] = useState(false);
  const myOption = session.options.find((o) => o.id === session.my_option_id);

  async function vote(optionId: number) {
    if (busy || session.status !== 'open' || !canInteract) return;
    setBusy(true);
    try { await castVote(session.id, optionId); show('Vote enregistré — modifiable jusqu\'à la clôture.'); onChanged(); }
    finally { setBusy(false); }
  }

  async function submitOption() {
    if (!writeIn.trim()) return;
    setBusy(true);
    try {
      await addVoteOption(session.id, writeIn.trim());
      setWriteIn('');
      show('Proposition transmise pour examen et vote collectif !');
      onChanged();
    } finally { setBusy(false); }
  }

  const closedMode = session.mode === 'closed';

  return (
    <section className="bg-surface-container-lowest rounded-2xl p-6 lg:p-7 shadow-card transition-all hover:shadow-card-hover flex flex-col gap-6">
      {Toast}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full font-headline text-label-sm tracking-wide uppercase ${closedMode ? 'bg-primary/10 text-primary' : 'bg-tertiary-container/20 text-tertiary-container font-semibold'}`}>
              {closedMode ? 'Vote Réglementaire' : 'Consultation Ouverte (Idéation)'}
            </span>
            {session.allow_write_in && (
              <span className="px-2.5 py-0.5 bg-surface-container text-on-surface-variant rounded-full font-headline text-label-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">edit_note</span> Option libre autorisée
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 font-headline text-label-sm px-3 py-1 rounded-full bg-surface-container text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            {session.status === 'open'
              ? session.closes_at
                ? <span className="text-error">Clôture le {new Date(session.closes_at).toLocaleDateString('fr-FR')}</span>
                : <span>Scrutin ouvert</span>
              : <span>Scrutin clôturé</span>}
          </div>
        </div>
        <div className="flex flex-col">
          <h2 className="font-headline text-headline-md text-on-surface mt-1">
            <Link to={`/votes/${session.id}`} className="hover:text-secondary transition-colors">{session.question}</Link>
          </h2>
          <p className="font-body text-body-sm text-on-surface-variant mt-1.5">
            Proposé par {session.created_by_name} • Ouvert le {new Date(session.opens_at).toLocaleDateString('fr-FR')}
          </p>
        </div>
        {myOption && session.status === 'open' && (
          <div className="bg-surface-container-low rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary shrink-0">
                <span className="material-symbols-outlined text-[18px]">check</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline text-label-md text-on-surface">Vous avez voté pour « <strong className="text-secondary font-bold">{myOption.label}</strong> ».</span>
                <span className="font-body text-body-sm text-outline">Votre choix reste modifiable jusqu'à la clôture.</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Options */}
      <div className="flex flex-col gap-3">
        {[...session.options].sort((a, b) => b.votes - a.votes).map((opt, idx) => {
          const pct = session.total_votes > 0 ? Math.round((opt.votes / session.total_votes) * 100) : 0;
          const mine = session.my_option_id === opt.id;
          return (
            <div
              key={opt.id}
              role={canInteract && session.status === 'open' ? 'button' : undefined}
              onClick={() => vote(opt.id)}
              className={`group relative block p-4 rounded-xl transition-all duration-200 flex flex-col gap-2 ${
                canInteract && session.status === 'open' ? 'cursor-pointer' : ''
              } ${mine ? 'bg-secondary/5 shadow-sm ring-1 ring-secondary/30' : 'bg-surface-container-lowest hover:bg-surface-container-low'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full mt-0.5 flex items-center justify-center shrink-0 ${mine ? 'bg-secondary' : 'bg-surface-container-highest'}`}>
                    <span className="w-2 h-2 rounded-full bg-surface-container-lowest" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-headline text-headline-sm ${mine ? 'text-secondary' : 'text-on-surface'} group-hover:text-secondary transition-colors`}>
                        {idx + 1}. {opt.label}
                      </span>
                      {opt.proposed_by_name && (
                        <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed-variant font-headline text-label-sm">Option agent</span>
                      )}
                    </div>
                    {opt.proposed_by_name && (
                      <span className="font-body text-body-sm text-on-surface-variant">Proposé par {opt.proposed_by_name}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={`font-headline text-headline-sm font-bold ${mine ? 'text-secondary' : 'text-on-surface'}`}>{pct}%</span>
                  <span className="font-headline text-label-sm text-outline block">{opt.votes} vote(s)</span>
                </div>
              </div>
              <ProgressBar value={pct} />
            </div>
          );
        })}
        {session.options.length === 0 && (
          <p className="font-body text-body-sm text-on-surface-variant italic">Aucune option pour l'instant — soyez le premier à proposer.</p>
        )}
      </div>

      {/* Write-in */}
      {canInteract && session.status === 'open' && (session.allow_write_in || session.mode === 'open') && (
        <div className="bg-surface-container-low/70 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[20px]">add_circle</span>
              <span className="font-headline text-label-md text-on-surface">Vous avez une autre formulation à proposer ?</span>
            </div>
            <span className="font-headline text-label-sm text-outline">Modération du Comité Éthique</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative w-full">
              <StitchInput
                className="!rounded-xl pr-10"
                value={writeIn} onChange={(e) => setWriteIn(e.target.value)}
                placeholder="Ajouter votre propre proposition…"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), submitOption())}
              />
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">lightbulb</span>
            </div>
            <button
              className="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-headline text-label-md shadow-sm transition-all whitespace-nowrap flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={submitOption} disabled={busy || !writeIn.trim()} type="button"
            >
              <span>Soumettre l'option</span>
              <span className="material-symbols-outlined text-[16px]">send</span>
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <div className="flex items-center gap-4 text-on-surface-variant font-headline text-label-sm">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">group</span>
            <span>{session.total_votes} votant(s)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">ballot</span>
            <span>{session.options.length} option(s)</span>
          </span>
        </div>
        <Link
          to={`/votes/${session.id}`}
          className="px-3.5 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-headline text-label-md hover:bg-secondary-fixed-dim transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span>Détail du scrutin</span>
        </Link>
      </div>
    </section>
  );
}

function CreateVoteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { show, Toast } = useToast();
  const [question, setQuestion] = useState('');
  const [mode, setMode] = useState<'closed' | 'open'>('closed');
  const [allowWriteIn, setAllowWriteIn] = useState(false);
  const [options, setOptions] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setQuestion(''); setMode('closed'); setAllowWriteIn(false); setOptions(''); setClosesAt(''); setError(''); } }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      await createVote({
        question, mode, allow_write_in: allowWriteIn,
        options: mode === 'closed' ? options.split('\n').map((s) => s.trim()).filter(Boolean) : [],
        closes_at: closesAt || null,
      });
      onClose();
      show('Nouvelle consultation publiée');
      onDone();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouvelle session de vote" icon="ballot">
      {Toast}
      <form onSubmit={submit} className="flex flex-col gap-4">
        <StitchField label="Question soumise au vote *">
          <StitchInput value={question} onChange={(e) => setQuestion(e.target.value)} required placeholder="Ex: Quelle règle de transparence pour les courriers rédigés avec IA ?" />
        </StitchField>
        <div className="grid gap-4 sm:grid-cols-2">
          <StitchField label="Mode de scrutin">
            <StitchSelect value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="closed">Fermé (options prédéfinies)</option>
              <option value="open">Libre (options proposées par les votants)</option>
            </StitchSelect>
          </StitchField>
          <StitchField label="Date de clôture">
            <StitchInput type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          </StitchField>
        </div>
        {mode === 'closed' && (
          <>
            <StitchField label="Options (une par ligne, min. 2) *">
              <StitchTextarea rows={4} value={options} onChange={(e) => setOptions(e.target.value)} required placeholder={'Oui, avec validation humaine\nNon, rédaction 100% humaine'} />
            </StitchField>
            <label className="flex items-center gap-2 font-body text-body-sm text-on-surface cursor-pointer">
              <input type="checkbox" className="accent-secondary w-4 h-4" checked={allowWriteIn} onChange={(e) => setAllowWriteIn(e.target.checked)} />
              Autoriser une réponse libre en plus (write-in)
            </label>
          </>
        )}
        {error && <StitchAlert kind="error">{error}</StitchAlert>}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-full font-headline text-label-md text-on-surface-variant hover:bg-surface-container transition-all">
            Annuler
          </button>
          <PrimaryButton type="submit" icon="how_to_vote" disabled={busy}>{busy ? 'Création…' : 'Créer la session'}</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export default function Votes() {
  const { isIanimateur } = useAuth();
  const [items, setItems] = useState<VoteSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [guideOpen, setGuideOpen] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    try { setItems(await getVotes()); } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const open = items.filter((s) => s.status === 'open');
  const closed = items.filter((s) => s.status === 'closed');
  const shown = tab === 'open' ? open : closed;
  const totalVotes = items.reduce((acc, s) => acc + s.total_votes, 0);
  const nextClosing = useMemo(
    () => open.filter((s) => s.closes_at).sort((a, b) => +new Date(a.closes_at!) - +new Date(b.closes_at!))[0],
    [open]
  );

  return (
    <div>
      {/* Bandeau d'animation civique */}
      <section className="relative w-full bg-gradient-to-r from-primary via-primary-container to-secondary text-on-primary py-7 px-4 lg:px-8 shadow-sm overflow-hidden">
        <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full bg-secondary-container/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-20 w-64 h-64 rounded-full bg-tertiary-fixed/15 blur-2xl pointer-events-none" />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-surface-container-lowest/15 backdrop-blur-md p-3 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-tertiary-fixed text-[30px] filled">how_to_vote</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-headline text-label-sm uppercase tracking-widest text-primary-fixed bg-surface-container-lowest/10 px-2.5 py-0.5 rounded-full">Démocratie Participative Interne</span>
                <span className="inline-flex items-center gap-1 font-headline text-label-sm text-tertiary-fixed bg-tertiary-container/40 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed animate-ping" />
                  En direct
                </span>
              </div>
              <h1 className="font-headline text-headline-lg-mobile lg:text-headline-lg text-on-primary tracking-tight mt-0.5">Votre avis façonne la Charte Éthique de l'IA !</h1>
              <p className="font-body text-body-sm text-surface-container-high">
                Déjà <span className="font-headline text-headline-sm font-bold text-tertiary-fixed">{totalVotes} vote(s)</span> enregistrés par les agents et ambassadeurs d'Ivry-sur-Seine.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-start md:justify-end">
            <div className="bg-surface-container-lowest/10 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary-fixed text-[24px]">verified_user</span>
              <div className="flex flex-col">
                <span className="font-headline text-label-sm text-surface-container-high">Scrutin municipal sécurisé</span>
                <span className="font-headline text-label-md text-on-primary">1 voix / agent • révisable</span>
              </div>
            </div>
            <button
              className="px-4 py-2 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container-lowest/90 font-headline text-label-md transition-all flex items-center gap-2 shadow-sm"
              onClick={() => setGuideOpen((v) => !v)} type="button"
            >
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Règles de consultation</span>
            </button>
          </div>
        </div>
      </section>

      <div className="w-full max-w-7xl mx-auto px-4 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <main className="lg:col-span-8 flex flex-col gap-8">
            {/* Onglets */}
            <div className="flex items-center justify-between bg-surface-container-low p-1.5 rounded-2xl shadow-sm">
              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                <button
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-headline text-label-md transition-all flex items-center justify-center gap-2 ${tab === 'open' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setTab('open')} type="button"
                >
                  <span className="material-symbols-outlined text-[18px] filled">ballot</span>
                  <span>Consultations actives</span>
                  <span className="px-2 py-0.5 rounded-full bg-secondary/10 text-secondary font-headline text-label-sm">{open.length}</span>
                </button>
                <button
                  className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-headline text-label-md transition-all flex items-center justify-center gap-2 ${tab === 'closed' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setTab('closed')} type="button"
                >
                  <span className="material-symbols-outlined text-[18px]">task_alt</span>
                  <span>Sessions terminées &amp; Résultats</span>
                  <span className="px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface-variant font-headline text-label-sm">{closed.length}</span>
                </button>
              </div>
              {isIanimateur && (
                <PrimaryButton icon="add_circle" onClick={() => setModalOpen(true)} className="hidden md:inline-flex !py-2">
                  Nouvelle session
                </PrimaryButton>
              )}
            </div>
            {isIanimateur && (
              <PrimaryButton icon="add_circle" onClick={() => setModalOpen(true)} className="md:hidden self-start">
                Nouvelle session
              </PrimaryButton>
            )}

            {guideOpen && (
              <div className="bg-surface-container-low rounded-2xl p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <span className="material-symbols-outlined text-secondary text-[24px]">info</span>
                  <div className="flex flex-col gap-1">
                    <h4 className="font-headline text-headline-sm text-on-surface">Protocole des Consultations Internes</h4>
                    <p className="font-body text-body-sm text-on-surface-variant">
                      Chaque agent de la Ville d'Ivry-sur-Seine dispose d'une voix par scrutin. En mode fermé avec option libre (write-in), vous pouvez souscrire aux options pré-rédigées ou soumettre un amendement original. Les votes restent révisables jusqu'à l'heure limite du scrutin.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {error && <StitchAlert kind="error">{error}</StitchAlert>}
            {loading ? <StitchSpinner />
              : shown.length === 0 ? (
                <StitchEmpty icon="how_to_vote">
                  {tab === 'open' ? "Aucune consultation active pour l'instant." : 'Aucune session terminée.'}
                </StitchEmpty>
              ) : shown.map((s) => <VoteSessionCard key={s.id} session={s} onChanged={load} />)}
          </main>

          {/* Colonne droite */}
          <aside className="lg:col-span-4 flex flex-col gap-6">
            <SectionCard className="p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary-fixed flex items-center justify-center text-on-primary-fixed-variant">
                    <span className="material-symbols-outlined text-[20px]">analytics</span>
                  </div>
                  <h3 className="font-headline text-headline-sm text-on-surface">Mobilisation</h3>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {[
                  { label: 'Voix exprimées', value: totalVotes, icon: 'how_to_vote' },
                  { label: 'Consultations actives', value: open.length, icon: 'ballot' },
                  { label: 'Sessions clôturées', value: closed.length, icon: 'task_alt' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low">
                    <div className="flex items-center gap-2.5">
                      <span className="material-symbols-outlined text-secondary text-[20px]">{icon}</span>
                      <span className="font-headline text-label-md text-on-surface">{label}</span>
                    </div>
                    <span className="font-headline text-headline-sm text-primary font-bold">{value}</span>
                  </div>
                ))}
              </div>
              {items.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between font-body text-body-sm">
                    <span className="text-on-surface-variant">Sessions auxquelles vous avez participé</span>
                    <span className="font-headline text-label-md text-primary font-bold">
                      {items.filter((s) => s.my_option_id).length}/{items.length}
                    </span>
                  </div>
                  <ProgressBar value={items.length ? (items.filter((s) => s.my_option_id).length / items.length) * 100 : 0} />
                </div>
              )}
            </SectionCard>

            {nextClosing && (
              <SectionCard className="p-6 flex flex-col gap-3">
                <span className="font-headline text-label-sm tracking-wider uppercase text-error font-bold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">schedule</span>
                  Prochaine clôture
                </span>
                <h3 className="font-headline text-headline-sm text-on-surface leading-snug">{nextClosing.question}</h3>
                <p className="font-body text-body-sm text-on-surface-variant">
                  Fin du scrutin le {new Date(nextClosing.closes_at!).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
                <Link
                  to={`/votes/${nextClosing.id}`}
                  className="w-full py-2.5 px-4 bg-secondary hover:bg-secondary-container text-on-secondary rounded-lg font-headline text-label-md transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">how_to_vote</span>
                  <span>{nextClosing.my_option_id ? 'Revoir mon vote' : 'Voter avant la clôture'}</span>
                </Link>
              </SectionCard>
            )}

            <div className="bg-surface-container-low p-5 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-outline text-[18px]">gavel</span>
                <span className="font-headline text-label-sm uppercase tracking-wider text-outline">Comité Éthique</span>
              </div>
              <p className="font-body text-body-sm text-on-surface-variant">
                Les résultats des consultations réglementaires sont versés au dossier de la Charte et présentés au Comité Éthique Municipal.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <CreateVoteModal open={modalOpen} onClose={() => setModalOpen(false)} onDone={load} />
    </div>
  );
}
