/* CSV import / export / template generation.
   Hand-written parser — no eval, no regex surprises. RFC 4180-ish. */

/* ----- Serialization ---------------------------------------------------- */

function csvEscape(value) {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(arr) {
  return arr.map(csvEscape).join(",");
}

/* Build assessment CSV.
   Two sections: context rows (section=context), then one row per question.
*/
function buildAssessmentCsv(state) {
  const lines = [];
  lines.push(csvRow(["section", "dimension", "question_id", "question_prompt", "answer_index", "answer_label", "answer_risk", "tripwire", "evidence"]));

  // Context rows
  for (const f of CONTEXT_FIELDS) {
    const v = state.context[f.id] || "";
    lines.push(csvRow(["context", "", f.id, f.label, "", v, "", "", ""]));
  }

  // Answer rows
  for (const dim of DIMENSIONS) {
    for (const q of dim.questions) {
      const idx = state.answers[q.id];
      const opt = (idx != null) ? q.options[idx] : null;
      const evid = state.evidence[q.id] || "";
      lines.push(csvRow([
        "answer",
        dim.id,
        q.id,
        q.prompt,
        idx == null ? "" : idx,
        opt ? opt.label : "",
        opt ? opt.risk : "",
        opt && opt.tripwire ? "yes" : "",
        evid
      ]));
    }
  }
  return lines.join("\n") + "\n";
}

function buildTemplateCsv() {
  const lines = [];
  lines.push(csvRow(["section", "dimension", "question_id", "question_prompt", "answer_index", "answer_label", "answer_risk", "tripwire", "evidence"]));
  lines.push(csvRow(["# Instructions", "", "", "Fill out answer_index (0-4) for each question row. Keep the header row intact. 'context' rows: put your value in answer_label.", "", "", "", "", ""]));

  for (const f of CONTEXT_FIELDS) {
    const sample = {
      agent_name: "SupportTriageBot v2",
      agent_purpose: "Classify inbound customer emails and draft first-pass replies.",
      assessor: "Jane Doe, Senior Security Engineer",
      assessment_date: new Date().toISOString().slice(0, 10),
      top_attack_vectors: "1. Prompt injection via inbound email (OWASP LLM01)\n2. Data exfiltration through drafted replies\n3. Memory poisoning via persisted ticket context\n4. Third-party MCP plugin compromise\n5. Reward-hacking in online fine-tune loop"
    };
    lines.push(csvRow(["context", "", f.id, f.label, "", sample[f.id] || "", "", "", ""]));
  }
  // Example filled first question of A with a mid-risk answer + evidence.
  const sampleAnswers = { A1: 2, A2: 1, A3: 2, A4: 1, A5: 2, G1: 1, G2: 1, G3: 2, G4: 1, G5: 2, E1: 1, E2: 0, E3: 1, E4: 1, E5: 2, N1: 2, N2: 1, N3: 1, N4: 0, N5: 1, T1: 3, T2: 1, T3: 2, T4: 1, T5: 1 };
  for (const dim of DIMENSIONS) {
    for (const q of dim.questions) {
      const idx = sampleAnswers[q.id];
      const opt = q.options[idx];
      lines.push(csvRow([
        "answer", dim.id, q.id, q.prompt, idx, opt.label, opt.risk, opt.tripwire ? "yes" : "",
        q.id === "T1" ? "Support mailbox — sanitizer layer is Prompt Armor v0.3, unverified against ATLAS AML.T0051." : ""
      ]));
    }
  }
  return lines.join("\n") + "\n";
}

/* ----- Parsing ---------------------------------------------------------- */

function parseCsv(text) {
  const rows = [];
  let cur = [], field = "", inQuotes = false, i = 0;
  text = text.replace(/^﻿/, ""); // strip BOM
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ",") { cur.push(field); field = ""; i++; continue; }
      if (ch === "\r") { i++; continue; }
      if (ch === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; i++; continue; }
      field += ch; i++;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

function importAssessmentCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) throw new Error("Empty CSV.");
  const header = rows[0].map(h => String(h || "").trim().toLowerCase());
  const required = ["section", "question_id", "answer_label", "answer_index"];
  for (const r of required) {
    if (!header.includes(r)) throw new Error(`Missing column: ${r}`);
  }
  const idx = name => header.indexOf(name);
  const iSec = idx("section"), iQid = idx("question_id"), iAIdx = idx("answer_index"),
        iALbl = idx("answer_label"), iEvid = idx("evidence");

  const context = {}, answers = {}, evidence = {};
  const knownQ = new Set();
  for (const dim of DIMENSIONS) for (const q of dim.questions) knownQ.add(q.id);
  const knownCtx = new Set(CONTEXT_FIELDS.map(f => f.id));

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const sec = String(row[iSec] || "").trim().toLowerCase();
    const qid = String(row[iQid] || "").trim();
    if (!sec || !qid) continue;
    if (sec.startsWith("#")) continue;
    if (sec === "context" && knownCtx.has(qid)) {
      context[qid] = String(row[iALbl] || "");
    } else if (sec === "answer" && knownQ.has(qid)) {
      const rawIdx = String(row[iAIdx] || "").trim();
      if (rawIdx !== "") {
        const n = Number(rawIdx);
        if (Number.isInteger(n) && n >= 0 && n <= 4) {
          answers[qid] = n;
        }
      }
      if (iEvid >= 0) {
        const e = String(row[iEvid] || "");
        if (e) evidence[qid] = e;
      }
    }
  }
  return { context, answers, evidence };
}

/* ----- Download helper -------------------------------------------------- */

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 250);
}
