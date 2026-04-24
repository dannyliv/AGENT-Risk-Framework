/* Local persistence + tamper-evident hash.
   Data lives only in localStorage on the user's machine. */

const STORAGE_KEY = "agent_framework_state_v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (e) {
    console.warn("Could not load state, starting fresh:", e);
    return emptyState();
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not save state:", e);
  }
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

function emptyState() {
  return {
    version: FRAMEWORK_VERSION,
    context: {},
    answers: {},
    evidence: {},
    updated: null
  };
}

function normalizeState(s) {
  const base = emptyState();
  return {
    version: s.version || base.version,
    context: s.context && typeof s.context === "object" ? s.context : {},
    answers: s.answers && typeof s.answers === "object" ? s.answers : {},
    evidence: s.evidence && typeof s.evidence === "object" ? s.evidence : {},
    updated: s.updated || null
  };
}

/* Deterministic canonical string for hashing (answers + evidence only). */
function canonicalizeForHash(state) {
  const keys = [];
  for (const dim of DIMENSIONS) for (const q of dim.questions) keys.push(q.id);
  const parts = [];
  for (const k of keys) {
    const a = state.answers[k];
    const e = (state.evidence[k] || "").replace(/\r\n/g, "\n");
    parts.push(`${k}|${a == null ? "" : a}|${e}`);
  }
  parts.push(`ctx|${state.context.agent_name || ""}|${state.context.assessor || ""}|${state.context.assessment_date || ""}`);
  return parts.join("\n");
}

async function computeHash(state) {
  const canon = canonicalizeForHash(state);
  try {
    const enc = new TextEncoder().encode(canon);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
    return hex;
  } catch {
    return null;
  }
}
