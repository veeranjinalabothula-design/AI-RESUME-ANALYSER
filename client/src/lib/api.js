const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, options);
  } catch {
    throw new Error("Can't reach the API. Start the server with npm run dev.");
  }
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || `Request failed (${response.status}).`);
  return payload;
}

export function analyze(resumeText, jobDescription, file) {
  if (file) {
    const body = new FormData();
    body.append("resume", file);
    body.append("jobDescription", jobDescription);
    return request("/api/analyze", { method: "POST", body });
  }
  return request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText, jobDescription })
  });
}

export function authenticate(action, details) {
  return request(`/api/auth/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(details)
  });
}

export function getAnalyses(token) {
  return request("/api/analyses", { headers: { Authorization: `Bearer ${token}` } });
}

export function saveAnalysis(token, result, title) {
  return request("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ result, title })
  });
}

export function deleteAnalysis(token, id) {
  return request(`/api/analyses/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
}
