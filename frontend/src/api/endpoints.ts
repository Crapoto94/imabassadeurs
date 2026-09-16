import { api, API_URL } from './client';
import type { AiResult, Comment, Experiment, GraphData, Principle, Resource, Risk, User, VoteSession } from '../types';

// ── Auth ──
export const login = (username: string, password: string) =>
  api.post<{ token: string; user: User }>('/api/v1/auth/login', { username, password }).then((r) => r.data);

// ── Ressources ──
export const getResources = (params?: Record<string, unknown>) =>
  api.get<Resource[]>('/api/v1/resources', { params }).then((r) => r.data);
export const getResource = (id: number) => api.get<Resource>(`/api/v1/resources/${id}`).then((r) => r.data);
export const createResource = (form: FormData) =>
  api.post('/api/v1/resources', form).then((r) => r.data);
export const reviewResource = (id: number, status: string, note?: string) =>
  api.post(`/api/v1/resources/${id}/review`, { status, note }).then((r) => r.data);
export const rateResource = (id: number, stars: number) =>
  api.post(`/api/v1/resources/${id}/rate`, { stars }).then((r) => r.data);
export const synthResource = (id: number) =>
  api.post<AiResult>(`/api/v1/resources/${id}/synthesize`).then((r) => r.data);
export const synthResourceThread = (id: number) =>
  api.post<AiResult>(`/api/v1/resources/${id}/synthesize-thread`).then((r) => r.data);

// ── Expérimentations ──
export const getExperiments = (params?: Record<string, unknown>) =>
  api.get<Experiment[]>('/api/v1/experiments', { params }).then((r) => r.data);
export const getExperiment = (id: number) => api.get<Experiment>(`/api/v1/experiments/${id}`).then((r) => r.data);
export const createExperiment = (data: Partial<Experiment>) =>
  api.post('/api/v1/experiments', data).then((r) => r.data);
export const updateExperimentStatus = (id: number, status: string) =>
  api.patch(`/api/v1/experiments/${id}/status`, { status }).then((r) => r.data);
export const joinExperiment = (id: number) => api.post(`/api/v1/experiments/${id}/join`).then((r) => r.data);
export const synthExperiment = (id: number) =>
  api.post<AiResult>(`/api/v1/experiments/${id}/synthesize`).then((r) => r.data);

// ── Risques ──
export const getRisks = (params?: Record<string, unknown>) =>
  api.get<Risk[]>('/api/v1/risks', { params }).then((r) => r.data);
export const getRisk = (id: number) => api.get<Risk>(`/api/v1/risks/${id}`).then((r) => r.data);
export const createRisk = (data: Partial<Risk>) => api.post('/api/v1/risks', data).then((r) => r.data);
export const amendRisk = (id: number, data: { importance: number; probability: number; reason?: string }) =>
  api.post(`/api/v1/risks/${id}/amend`, data).then((r) => r.data);
export const synthRisk = (id: number) =>
  api.post<AiResult>(`/api/v1/risks/${id}/synthesize`).then((r) => r.data);

// ── Votes ──
export const getVotes = () => api.get<VoteSession[]>('/api/v1/votes').then((r) => r.data);
export const getVote = (id: number) => api.get<VoteSession>(`/api/v1/votes/${id}`).then((r) => r.data);
export const createVote = (data: Record<string, unknown>) => api.post('/api/v1/votes', data).then((r) => r.data);
export const addVoteOption = (id: number, label: string) =>
  api.post(`/api/v1/votes/${id}/options`, { label }).then((r) => r.data);
export const castVote = (id: number, optionId: number) =>
  api.post(`/api/v1/votes/${id}/vote`, { option_id: optionId }).then((r) => r.data);
export const closeVote = (id: number) => api.post(`/api/v1/votes/${id}/close`).then((r) => r.data);

// ── Commentaires ──
export const getComments = (type: string, id: number) =>
  api.get<Comment[]>(`/api/v1/comments/${type}/${id}`).then((r) => r.data);
export const addComment = (type: string, id: number, body: string, parentId?: number) =>
  api.post(`/api/v1/comments/${type}/${id}`, { body, parent_id: parentId }).then((r) => r.data);
export const likeComment = (commentId: number) =>
  api.post<{ liked: boolean }>(`/api/v1/comments/${commentId}/like`).then((r) => r.data);

// ── Cartographie ──
export const getGraph = () => api.get<GraphData>('/api/v1/mapping/graph').then((r) => r.data);
export const getStats = () => api.get<any>('/api/v1/mapping/stats').then((r) => r.data);
export const getPrinciples = () => api.get<Principle[]>('/api/v1/mapping/principles').then((r) => r.data);
export const createPrinciple = (data: { title: string; body: string }) =>
  api.post('/api/v1/mapping/principles', data).then((r) => r.data);
export const setPrincipleStatus = (id: number, status: string) =>
  api.patch(`/api/v1/mapping/principles/${id}/status`, { status }).then((r) => r.data);
export const createLink = (data: Record<string, unknown>) =>
  api.post('/api/v1/mapping/links', data).then((r) => r.data);
export const generateClusters = () => api.post<GraphData>('/api/v1/mapping/clusters/generate').then((r) => r.data);
export const getConsensus = () => api.get<any>('/api/v1/mapping/consensus').then((r) => r.data);

// ── Analyse ──
export const getActivity = (params?: Record<string, unknown>) =>
  api.get<any[]>('/api/v1/analytics/activity', { params }).then((r) => r.data);
export const getInteractions = (params?: Record<string, unknown>) =>
  api.get<any[]>('/api/v1/analytics/interactions', { params }).then((r) => r.data);
export const getKpis = () => api.get<any>('/api/v1/analytics/kpis').then((r) => r.data);
export const getDigestQuality = () => api.get<any[]>('/api/v1/analytics/digest-quality').then((r) => r.data);

// ── Compte ──
export const getAccount = () => api.get<{ user: User; preferences: Record<string, string> }>('/api/v1/account').then((r) => r.data);
export const setPreference = (category: string, frequency: string) =>
  api.put('/api/v1/account/preferences', { category, frequency }).then((r) => r.data);

// ── Admin ──
export const getSettings = () => api.get<any>('/api/v1/admin/settings').then((r) => r.data);
export const updateSettings = (data: Record<string, unknown>) => api.put('/api/v1/admin/settings', data).then((r) => r.data);
export const getUsers = (params?: Record<string, unknown>) => api.get<any[]>('/api/v1/admin/users', { params }).then((r) => r.data);
export const grantRole = (userId: number, role: string) => api.post(`/api/v1/admin/users/${userId}/roles`, { role }).then((r) => r.data);
export const revokeRole = (userId: number, role: string) => api.delete(`/api/v1/admin/users/${userId}/roles/${role}`).then((r) => r.data);
export const getAudit = (params?: Record<string, unknown>) => api.get<any[]>('/api/v1/admin/audit', { params }).then((r) => r.data);
export const getPrompts = () => api.get<any[]>('/api/v1/admin/prompts').then((r) => r.data);
export const updatePrompt = (actionKey: string, data: Record<string, unknown>) =>
  api.put(`/api/v1/admin/prompts/${actionKey}`, data).then((r) => r.data);
export const testPrompt = (actionKey: string, variables: Record<string, unknown>) =>
  api.post<AiResult>(`/api/v1/admin/prompts/${actionKey}/test`, { variables }).then((r) => r.data);
export const getAiModels = () => api.get<any>('/api/v1/admin/ai-models').then((r) => r.data);

// ── Modération (admin & modérateurs) ──
export const updateResource = (id: number, data: { title: string; description: string; url?: string | null }) =>
  api.put<Resource>(`/api/v1/resources/${id}`, data).then((r) => r.data);
export const deleteResource = (id: number) => api.delete(`/api/v1/resources/${id}`).then((r) => r.data);
export const updateComment = (id: number, body: string) => api.put(`/api/v1/comments/${id}`, { body }).then((r) => r.data);
export const deleteComment = (id: number) => api.delete(`/api/v1/comments/${id}`).then((r) => r.data);
export const updateExperiment = (id: number, data: Record<string, unknown>) =>
  api.put<Experiment>(`/api/v1/experiments/${id}`, data).then((r) => r.data);
export const deleteExperiment = (id: number) => api.delete(`/api/v1/experiments/${id}`).then((r) => r.data);
export const updateRisk = (id: number, data: Record<string, unknown>) =>
  api.put<Risk>(`/api/v1/risks/${id}`, data).then((r) => r.data);
export const deleteRisk = (id: number) => api.delete(`/api/v1/risks/${id}`).then((r) => r.data);
export const updateVote = (id: number, data: Record<string, unknown>) =>
  api.put<VoteSession>(`/api/v1/votes/${id}`, data).then((r) => r.data);
export const deleteVote = (id: number) => api.delete(`/api/v1/votes/${id}`).then((r) => r.data);
export const deleteVoteOption = (optionId: number) => api.delete(`/api/v1/votes/options/${optionId}`).then((r) => r.data);
export const updatePrinciple = (id: number, data: { title: string; body: string }) =>
  api.put(`/api/v1/mapping/principles/${id}`, data).then((r) => r.data);
export const deletePrinciple = (id: number) => api.delete(`/api/v1/mapping/principles/${id}`).then((r) => r.data);

export { API_URL };
