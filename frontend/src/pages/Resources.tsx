import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Link2, Plus, Search, Star, MessageSquare } from 'lucide-react';
import { Card, PageTitle, Button, Field, Input, Textarea, Select, Badge, Spinner, EmptyState, Alert } from '../components/ui';
import Pagination from '../components/Pagination';
import { createResource, getResources } from '../api/endpoints';
import { errMsg, API_URL } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import type { Resource } from '../types';

const STATUS: Record<string, { label: string; color: string }> = {
  published: { label: 'Publiée', color: 'green' },
  pending: { label: 'En attente', color: 'amber' },
  rejected: { label: 'Rejetée', color: 'red' },
};

export default function Resources() {
  const { canInteract } = useAuth();
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 12;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true); setError('');
    try {
      setItems(await getResources({ limit, offset, search: search || undefined, status: status || undefined }));
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [offset, status]);

  return (
    <div>
      <PageTitle
        title="Base documentaire"
        subtitle="Documents et liens utiles, notés et discutés par la communauté."
        action={canInteract && (
          <Button onClick={() => setShowForm((v) => !v)}><Plus size={16} /> Proposer une ressource</Button>
        )}
      />

      {showForm && <CreateForm onDone={() => { setShowForm(false); setOffset(0); load(); }} onCancel={() => setShowForm(false)} />}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Rechercher">
          <div className="flex items-center gap-2">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Titre ou description" onKeyDown={(e) => e.key === 'Enter' && (setOffset(0), load())} />
            <Button variant="secondary" onClick={() => { setOffset(0); load(); }}><Search size={16} /></Button>
          </div>
        </Field>
        <Field label="Statut">
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
            <option value="">Publiées</option>
            <option value="pending">En attente</option>
            <option value="rejected">Rejetées</option>
          </Select>
        </Field>
      </div>

      {error && <Alert kind="error">{error}</Alert>}
      {loading ? <div className="flex justify-center py-8"><Spinner /></div>
        : items.length === 0 ? <EmptyState>Aucune ressource pour ces critères.</EmptyState>
        : (
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((r) => (
              <Link key={r.id} to={`/ressources/${r.id}`}>
                <Card className="h-full p-5 transition hover:border-ville-500 hover:shadow-md">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {r.kind === 'pdf' ? <FileText size={18} className="text-ville-500" /> : <Link2 size={18} className="text-ville-500" />}
                      {r.title}
                    </div>
                    <Badge color={STATUS[r.status].color}>{STATUS[r.status].label}</Badge>
                  </div>
                  <p className="line-clamp-3 text-sm text-slate-600">{r.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1"><Star size={14} className="text-amber-400" /> {r.avg_stars ?? '—'} ({r.ratings_count})</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {r.comments_count}</span>
                    <span className="ml-auto">{r.proposed_by_name}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      <Pagination offset={offset} limit={limit} count={items.length} onChange={setOffset} />
    </div>
  );
}

function CreateForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [kind, setKind] = useState<'pdf' | 'link'>('link');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const form = new FormData();
      form.append('title', title);
      form.append('description', description);
      form.append('kind', kind);
      if (kind === 'link') form.append('url', url);
      if (kind === 'pdf' && file) form.append('file', file);
      await createResource(form);
      onDone();
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  }

  return (
    <Card className="mb-6 p-5">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Type"><Select value={kind} onChange={(e) => setKind(e.target.value as any)}><option value="link">Lien</option><option value="pdf">Fichier PDF</option></Select></Field>
        <Field label="Titre"><Input value={title} onChange={(e) => setTitle(e.target.value)} required /></Field>
        <Field label="Pourquoi ce document est intéressant ?"><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
        {kind === 'link'
          ? <Field label="URL"><Input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required /></Field>
          : <Field label="Fichier PDF (5 Mo max)"><Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></Field>}
        {error && <Alert kind="error">{error}</Alert>}
        <div className="flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Proposer'}</Button>
          <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        </div>
      </form>
    </Card>
  );
}

export { API_URL };
