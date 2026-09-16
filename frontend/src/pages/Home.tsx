import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FlaskConical, ShieldAlert, Vote, Network, TrendingUp } from 'lucide-react';
import { Card, PageTitle, Badge } from '../components/ui';
import { getStats } from '../api/endpoints';
import { useAuth } from '../hooks/useAuth';

const MODULES = [
  { to: '/ressources', icon: BookOpen, title: 'Base documentaire', desc: 'Partagez et annotez des ressources sur l’IA.' },
  { to: '/experimentations', icon: FlaskConical, title: 'Expérimentations', desc: 'Suivez les projets d’expérimentation IA.' },
  { to: '/risques', icon: ShieldAlert, title: 'Gestion des risques', desc: 'Recensez et qualifiez les risques identifiés.' },
  { to: '/votes', icon: Vote, title: 'Vote', desc: 'Participez aux votes de la démarche.' },
  { to: '/cartographie', icon: Network, title: 'Cartographie des idées', desc: 'Visualisez les idées et construisez la Charte.' },
];

export default function Home() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => { getStats().then(setStats).catch(() => {}); }, []);

  return (
    <div>
      <PageTitle
        title={`Bonjour ${user?.display_name?.split(' ')[0] || ''}`}
        subtitle="Espace de travail collectif pour l’élaboration de la Charte Éthique IA."
      />

      {stats && (
        <Card className="mb-6 p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            <TrendingUp size={16} aria-hidden /> Indicateurs de la démarche
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Idées émises', value: stats.ideas_total },
              { label: 'Idées retenues', value: stats.ideas_retained },
              { label: 'Taux de consensus', value: `${stats.consensus_rate} %` },
              { label: 'Principes adoptés', value: stats.principles_adopted },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-semibold text-ville-600">{s.value}</div>
                <div className="text-xs text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
          {stats.active_themes?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {stats.active_themes.map((t: any) => (
                <Badge key={t.label} color="blue">{t.label} · {t.items}</Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(({ to, icon: Icon, title, desc }) => (
          <Link key={to} to={to}>
            <Card className="h-full p-5 transition hover:border-ville-500 hover:shadow-md">
              <Icon className="mb-3 text-ville-500" size={24} aria-hidden />
              <h2 className="font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
