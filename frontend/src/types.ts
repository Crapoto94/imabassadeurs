export type Role = 'admin' | 'iambassadeur' | 'iaeclaireur' | 'ianimateur';

export interface User {
  id: number;
  ad_username: string;
  display_name: string;
  email: string | null;
  direction: string | null;
  service: string | null;
  roles: Role[];
}

export interface Resource {
  id: number;
  title: string;
  description: string;
  kind: 'pdf' | 'link';
  file_path: string | null;
  url: string | null;
  status: 'pending' | 'published' | 'rejected';
  review_note: string | null;
  proposed_by: number;
  proposed_by_name: string;
  avg_stars: number | null;
  ratings_count: number;
  comments_count: number;
  my_rating?: number | null;
  created_at: string;
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
  created_at: string;
  participants?: { id: number; display_name: string }[];
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
  created_at: string;
  amendments?: { id: number; importance: number; probability: number; amended_by_name: string; reason: string | null; created_at: string }[];
}

export interface VoteOption {
  id: number;
  label: string;
  proposed_by: number | null;
  proposed_by_name: string | null;
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
  likes: number;
  liked: boolean;
  created_at: string;
  replies: Comment[];
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
