export type Role = 'admin' | 'iambassadeur' | 'iaeclaireur' | 'ianimateur';

export type ThemeScope = 'resource' | 'experiment' | 'risk';

export interface Theme {
  id: number;
  slug: string;
  label: string;
  scope: ThemeScope;
  group_label: string | null;
  group_position?: number;
  position?: number;
  active?: boolean;
}

export interface User {
  id: number;
  ad_username: string;
  display_name: string;
  email: string | null;
  direction: string | null;
  service: string | null;
  avatar_v?: number | null;
  bio?: string | null;
  job_title?: string | null;
  roles: Role[];
}

export interface Ambassador {
  id: number;
  display_name: string;
  direction: string | null;
  service: string | null;
  job_title: string | null;
  bio: string | null;
  avatar_v: number | null;
  roles: Role[];
}

export interface Resource {
  id: number;
  title: string;
  description: string;
  kind: 'pdf' | 'link';
  file_path: string | null;
  url: string | null;
  level?: 'debutant' | 'intermediaire' | 'avance';
  is_mandatory?: boolean;
  status: 'pending' | 'published' | 'rejected';
  review_note: string | null;
  proposed_by: number;
  proposed_by_name: string;
  avg_stars: number | null;
  ratings_count: number;
  comments_count: number;
  my_rating?: number | null;
  my_progress?: number;
  source?: string | null;
  published_at?: string | null;
  content_type?: string | null;
  reading_effort?: string | null;
  related_type?: string | null;
  related_id?: number | null;
  created_at: string;
  edited_at?: string | null;
  themes?: Theme[];
}

export interface Experiment {
  id: number;
  title: string;
  description: string;
  objective: string;
  target_date: string | null;
  status: 'planned' | 'ongoing' | 'completed' | 'abandoned';
  created_by: number;
  created_by_name: string;
  participants_count: number;
  joined: boolean;
  comments_count: number;
  attachments_count?: number;
  created_at: string;
  participants?: { id: number; display_name: string }[];
  attachments?: ExperimentAttachment[];
  owner_service?: string | null;
  ai_tool?: string | null;
  ai_hosting?: string | null;
  personal_data?: boolean | null;
  expected_benefits?: string | null;
  feedback?: string | null;
  related_risk_id?: number | null;
  edited_at?: string | null;
  themes?: Theme[];
}

export interface ExperimentAttachment {
  id: number;
  file_path: string;
  original_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by_name: string;
  created_at: string;
}

export interface Risk {
  id: number;
  title: string;
  description: string;
  concerns_ivry: boolean;
  importance: number;
  probability: number;
  proposed_by: number;
  proposed_by_name: string;
  amendments_count: number;
  comments_count: number;
  mitigation?: string | null;
  affected_data?: string | null;
  related_experiment_id?: number | null;
  source_ref?: string | null;
  created_at: string;
  amendments?: { id: number; importance: number; probability: number; amended_by_name: string; reason: string | null; created_at: string }[];
  edited_at?: string | null;
  themes?: Theme[];
}

export interface VoteOption {
  id: number;
  label: string;
  proposed_by: number | null;
  proposed_by_name: string | null;
  justification?: string | null;
  votes: number;
}

export interface VoteSession {
  id: number;
  question: string;
  mode: 'closed' | 'open';
  allow_write_in: boolean;
  status: 'open' | 'closed';
  created_by: number;
  created_by_name: string;
  context?: string | null;
  opens_at: string;
  closes_at: string | null;
  total_votes: number;
  options: VoteOption[];
  my_option_id: number | null;
}

export interface Comment {
  id: number;
  parent_id: number | null;
  body: string;
  author_id: number;
  author_name: string;
  author_avatar_v?: number | null;
  likes: number;
  liked: boolean;
  source_ref?: string | null;
  created_at: string;
  replies: Comment[];
  edited_at?: string | null;
}

export interface Principle {
  id: number;
  title: string;
  body: string;
  status: 'draft' | 'adopted';
  created_by_name: string;
  links_count: number;
  created_at: string;
}

export interface GraphData {
  nodes: any[];
  edges: { source: string; target: string; kind: string }[];
  clusters: { id: number; label: string; description: string | null }[];
}

export interface AiResult {
  response: string;
  provider?: string;
  provider_label?: string;
  model_name?: string;
  action_key?: string;
}

export interface GamificationBadge {
  key: string;
  label: string;
  icon: string;
  earned: boolean;
  current: number;
  target: number;
}

export interface GamificationBreakdownItem {
  count: number;
  points: number;
}

export interface GamificationAxis {
  key: string;
  label: string;
  count: number;
  points: number;
  level: number;
  level_label: string;
}

export interface GamificationImpactItem {
  key: string;
  label: string;
  count: number;
  points: number;
}

export interface GamificationNextStep {
  key: string;
  label: string;
  icon: string;
  href: string;
}

export interface GamificationSummary {
  enabled: boolean;
  points: number;
  base_points: number;
  impact_points: number;
  points_adjustment: number;
  level: number;
  level_label: string;
  current_level_points: number;
  next_level_points: number | null;
  progress_pct: number;
  axes: GamificationAxis[];
  impact: GamificationImpactItem[];
  badges: GamificationBadge[];
  next_steps: GamificationNextStep[];
  breakdown: Record<string, GamificationBreakdownItem>;
  parcours: { total: number; lu: number };
}

// ── Backlog (bugs et idées) ──
export type BacklogType = 'bug' | 'evolution';
export type BacklogStatus = 'demandee' | 'acceptee' | 'refusee' | 'realisee';

export interface BacklogItem {
  id: number;
  type: BacklogType;
  title: string;
  description: string;
  app_version: string | null;
  status: BacklogStatus;
  reason: string | null;
  created_at: string;
  treated_at: string | null;
  author_id: number | null;
  author_name: string | null;
  treated_by_name: string | null;
}

// ── Annonces (bandeau / modale d'ouverture) ──
export type AnnouncementKind = 'bandeau' | 'modale';

export interface Announcement {
  id: number;
  kind: AnnouncementKind;
  title: string | null;
  message: string;
  ends_at: string;
}

export interface AnnouncementAdmin extends Announcement {
  starts_at: string;
  active: boolean;
  etat: 'en_cours' | 'programme' | 'termine' | 'desactive';
  created_by_name: string | null;
  dismissed_count: number;
}

// ── Le Mur de l'IA ──
export interface WallReaction { emoji: string; count: number; mine: boolean; names: string[] }
export interface WallPost {
  id: number;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_id: number | null;
  author_name: string | null;
  author_avatar_v: number | null;
  quote: { id: number; author_name: string | null; excerpt: string; deleted: boolean } | null;
  reactions: WallReaction[];
}
