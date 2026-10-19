import { http, unwrap } from "./http";

export function fetchDashboard() {
  return unwrap(http.get("/api/v1/admin/analytics/overview"));
}

export function fetchRatingRanking() {
  return unwrap(http.get("/api/v1/admin/ratings/ranking"));
}

export function fetchRatingTrend() {
  return unwrap(http.get("/api/v1/admin/ratings/trend"));
}

export function fetchAdminRatings(params: Record<string, unknown> = {}) {
  return unwrap(http.get("/api/v1/admin/ratings", { params }));
}

export function loginAdmin(username: string, password: string) {
  return unwrap(http.post("/api/v1/auth/login", { username, password }));
}

export function fetchAdminMe() {
  return unwrap(http.get("/api/v1/auth/me"));
}

export function fetchKnowledgeDocs(status = "all") {
  return unwrap(http.get("/api/v1/admin/knowledge-bases/default/documents", { params: { status } }));
}

export function uploadKnowledgeDocument(file: File, title: string, changeNote = "initial upload") {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title);
  form.append("change_note", changeNote);
  return unwrap(http.post("/api/v1/admin/knowledge-bases/default/documents", form));
}

export function updateKnowledgeDocument(documentId: string, payload: { title?: string; content?: string; change_note?: string }) {
  return unwrap(http.put(`/api/v1/admin/documents/${encodeURIComponent(documentId)}`, payload));
}

export function publishKnowledgeDocument(documentId: string) {
  return unwrap(http.post(`/api/v1/admin/documents/${encodeURIComponent(documentId)}/publish`));
}

export function archiveKnowledgeDocument(documentId: string) {
  return unwrap(http.post(`/api/v1/admin/documents/${encodeURIComponent(documentId)}/archive`));
}

export function deleteKnowledgeDocument(documentId: string) {
  return unwrap(http.delete(`/api/v1/admin/documents/${encodeURIComponent(documentId)}`));
}

export function fetchKnowledgeVersions(documentId: string) {
  return unwrap(http.get(`/api/v1/admin/documents/${encodeURIComponent(documentId)}/versions`));
}

export function fetchKnowledgeHistory(documentId: string) {
  return unwrap(http.get(`/api/v1/admin/documents/${encodeURIComponent(documentId)}/history`));
}

export function reindexKnowledgeBase() {
  return unwrap(http.post("/api/v1/admin/knowledge-bases/default/reindex"));
}

export function searchKnowledge(query: string) {
  return unwrap(http.post("/api/v1/admin/knowledge-bases/default/test-retrieve", { query }));
}

export async function fetchActiveAvatar() {
  const profiles = await unwrap<any[]>(http.get("/api/v1/admin/avatar/profiles"));
  return profiles.find((item) => item.enabled) || profiles[0] || {};
}

export function saveAvatarConfig(payload: Record<string, unknown>) {
  return unwrap(http.post("/api/v1/admin/avatar/profiles", payload));
}
