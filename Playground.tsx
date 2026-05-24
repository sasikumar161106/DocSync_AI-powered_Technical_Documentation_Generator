export type ViewState = 'dashboard' | 'playground' | 'settings';

export interface GeneratedDoc {
  id: string;
  filename: string;
  content: string;
  timestamp: string;
}

export interface Repo {
  id: string;
  name: string;
  connectedAt: string;
  status: 'active' | 'syncing' | 'error';
}
