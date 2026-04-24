/* Dashboard rendering: verdict, scores, SVG radar, findings, recommendations,
   and the hidden print-ready report used by window.print(). */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function riskColor(risk) {
  if (risk <= 0.5) return "#1f8a4c";
  if (risk < 1.5)  return "#8ab935";
  if (risk < 2.5)  return "#c77d0a";
  if (risk < 3.25) return "#d14e27";
  return "#b3261e";
}

function riskBadge(risk) {
  if (risk <= 0) return { label: "low", bg: "#dcfce7", fg: "#166534" };
  if (risk === 1) return { label: "elevated", bg: "#ecfccb", fg: "#4d7c0f" };
  if (risk === 2) return { label: "moderate", bg: "#fef3c7", fg: "#a16207" };
  if (risk === 3) return { label: "high", bg: "#fed7aa", fg: "#b45309" };
  return { label: "critical", bg: "#fecaca", fg: "#991b1b" };
}

/* --- SVG radar ---------------------------------------------------------- */

function renderRadar(scores) {
  const W = 360, H = 360, CX = W / 2, CY = H / 2, R = 130;
  const dims = DIMENSIONS.map(d => ({ id: d.id, name: d.name, score: scores[d.id]?.score ?? 0 }));
  const N = dims.length;

  const angle = i => (-Math.PI / 2) + (i * 2 * Math.PI / N);
  const point = (i, r) => [CX + r * Math.cos(angle(i)), CY + r * Math.sin(angle(i))];

  // Grid rings at 1,2,3,4
  const rings = [];
  for (let k = 1; k <= 4; k++) {
    const pts = [];
    for (let i = 0; i < N; i++) {
      const [x, y] = point(i, R * k / 4);
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    rings.push(`<polygon points="${pts.join(" ")}" fill="none" stroke="var(--border-strong)" stroke-width="0.75" stroke-dasharray="${k === 4 ? "none" : "2 3"}"/>`);
  }

  // Axes + labels
  const axes = [], labels = [];
  for (let i = 0; i < N; i++) {
    const [x, y] = point(i, R);
    axes.push(`<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="var(--border-strong)" stroke-width="0.75"/>`);
    const [lx, ly] = point(i, R + 18);
    const anchor = Math.abs(lx - CX) < 10 ? "middle" : (lx > CX ? "start" : "end");
    labels.push(`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="12" font-weight="600" fill="var(--ink)">${escapeHtml(dims[i].id)}</text>`);
    const [lx2, ly2] = point(i, R + 34);
    labels.push(`<text x="${lx2.toFixed(1)}" y="${ly2.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="var(--muted)">${escapeHtml(dims[i].name)}</text>`);
  }

  // Data polygon
  const pts = [];
  const dots = [];
  for (let i = 0; i < N; i++) {
    const s = Math.max(0, Math.min(4, dims[i].score));
    const [x, y] = point(i, R * s / 4);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    const fill = riskColor(s);
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="${fill}" stroke="#fff" stroke-width="1.5"/>`);
  }
  const maxScore = Math.max(...dims.map(d => d.score));
  const polyColor = riskColor(maxScore);

  return `
<svg viewBox="0 0 ${W + 80} ${H + 20}" width="440" role="img" aria-label="A.G.E.N.T. radar of dimension risk scores">
  <g transform="translate(40,10)">
    ${rings.join("")}
    ${axes.join("")}
    <polygon points="${pts.join(" ")}" fill="${polyColor}" fill-opacity="0.18" stroke="${polyColor}" stroke-width="2" stroke-linejoin="round"/>
    ${dots.join("")}
    ${labels.join("")}
    <text x="${CX}" y="${CY + R + 60}" text-anchor="middle" font-size="10" fill="var(--muted)">Radar scale: 0 (inner, low risk) &#8594; 4 (outer, critical)</text>
  </g>
</svg>`;
}

/* --- Main dashboard render --------------------------------------------- */

function renderDashboard(state, scores, hashHex) {
  const host = document.getElementById("dashboard");
  if (!host) return;
  if (!scores.complete) {
    host.innerHTML = `
      <div class="empty-dash">
        <h3>Finish the assessment first</h3>
        <p>Answer all ${DIMENSIONS.reduce((s, d) => s + d.questions.length, 0)} questions — you've answered
           ${Object.keys(state.answers).length}.</p>
        <button type="button" class="btn btn-primary" data-action="view-assess">&larr; Back to assessment</button>
      </div>
    `;
    return;
  }

  const meta = verdictMeta(scores.verdict);

  const dimCards = DIMENSIONS.map(d => {
    const s = scores.perDimension[d.id]?.score ?? 0;
    const pct = Math.min(100, (s / 4) * 100);
    const color = riskColor(s);
    return `
      <div class="dim-score">
        <div class="ds-head">
          <span class="ds-letter">${d.id}</span>
          <span class="ds-name">${escapeHtml(d.name)}</span>
        </div>
        <div class="ds-value" style="color:${color}">${s.toFixed(2)}<span style="font-size:12px;color:var(--muted);font-weight:400">/4.0</span></div>
        <div class="ds-bar"><div class="ds-bar-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>
    `;
  }).join("");

  const tripwireBlock = scores.tripwires.length ? `
    <div class="tripwire-panel" role="alert">
      <h3>${scores.tripwires.length} tripwire${scores.tripwires.length === 1 ? "" : "s"} triggered — automatic BLOCK</h3>
      <ul>
        ${scores.tripwires.map(t => `<li><b>${escapeHtml(t.qid)}</b> (${escapeHtml(t.dimName)}): ${escapeHtml(t.prompt)} — &ldquo;${escapeHtml(t.answer)}&rdquo;</li>`).join("")}
      </ul>
    </div>
  ` : "";

  // Top findings: all answers with risk >= 2, sorted high to low.
  const findings = [];
  for (const dim of DIMENSIONS) {
    for (const q of dim.questions) {
      const aIdx = state.answers[q.id];
      if (aIdx == null) continue;
      const opt = q.options[aIdx];
      if (opt.risk >= 2) {
        findings.push({ dim: dim.name, dimId: dim.id, qid: q.id, prompt: q.prompt, answer: opt.label, risk: opt.risk, tripwire: !!opt.tripwire });
      }
    }
  }
  findings.sort((a, b) => b.risk - a.risk || a.qid.localeCompare(b.qid));
  const findingsHtml = findings.length ? findings.map(f => {
    const b = riskBadge(f.risk);
    return `
      <div class="finding">
        <span class="f-qid">${escapeHtml(f.qid)}</span>
        <div>
          <div class="f-prompt">${escapeHtml(f.prompt)} <span class="muted">— ${escapeHtml(f.dim)}</span></div>
          <div class="f-answer">&ldquo;${escapeHtml(f.answer)}&rdquo;${f.tripwire ? ' <b style="color:#b3261e">· tripwire</b>' : ""}</div>
        </div>
        <span class="f-risk" style="background:${b.bg};color:${b.fg}">risk ${f.risk} · ${b.label}</span>
      </div>
    `;
  }).join("") : `<div class="finding"><div></div><div class="f-prompt">No findings above moderate risk. Maintain current controls.</div><div></div></div>`;

  const recs = recommendationsFor(scores, state);

  host.innerHTML = `
    <div class="intro">
      <h2>Risk dashboard${state.context.agent_name ? ` — ${escapeHtml(state.context.agent_name)}` : ""}</h2>
      <p class="lede">Review the verdict, address tripwires first, then the highest-risk findings.</p>
    </div>

    <div class="dash-hero">
      <div class="verdict-block">
        <span class="verdict-badge" style="background:${meta.color}">${meta.label}</span>
        <p class="verdict-desc">${escapeHtml(meta.desc)}</p>
        <div class="verdict-score">overall ${scores.overall?.toFixed(2) ?? "—"}/4 · ${scores.reasoning.join(" ")}</div>
      </div>
      <div class="radar-wrap">${renderRadar(scores.perDimension)}</div>
    </div>

    <div class="dim-scores">${dimCards}</div>

    ${tripwireBlock}

    ${state.context.top_attack_vectors ? `
      <div class="attack-vectors-card">
        <h3>Top attack vectors (documented by assessor)</h3>
        <pre>${escapeHtml(state.context.top_attack_vectors)}</pre>
      </div>
    ` : ""}

    <div class="dash-detail">
      <h3>Findings at or above moderate risk</h3>
      <div class="findings-list">${findingsHtml}</div>
    </div>

    <div class="recommendations">
      <h3>Recommended next steps</h3>
      <ol>${recs.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ol>
    </div>

    <div class="audit-strip" aria-label="Audit trail">
      <span><b>framework:</b> A.G.E.N.T. v${escapeHtml(FRAMEWORK_VERSION)}</span>
      <span><b>assessed:</b> ${escapeHtml(state.context.assessment_date || new Date().toISOString().slice(0, 10))}</span>
      <span><b>hash:</b> ${hashHex ? escapeHtml(hashHex.slice(0, 16)) + "…" : "(unsupported)"}</span>
    </div>

    <div class="dash-actions no-print">
      <button type="button" class="btn btn-primary" data-action="print">Save as PDF / print</button>
      <button type="button" class="btn btn-ghost" data-action="export-csv">Export CSV</button>
      <button type="button" class="btn btn-ghost" data-action="view-assess">Back to assessment</button>
      <button type="button" class="btn btn-ghost" data-action="reset">Start new agent assessment</button>
    </div>
  `;

  renderPrintReport(state, scores, hashHex);
}

/* --- Print-ready DOM (rendered to a hidden container, revealed by @media print) --- */

function renderPrintReport(state, scores, hashHex) {
  let host = document.getElementById("print-report");
  if (!host) {
    host = document.createElement("div");
    host.id = "print-report";
    host.className = "print-report";
    document.body.appendChild(host);
  }

  const meta = verdictMeta(scores.verdict);
  const ctxItems = CONTEXT_FIELDS.map(f => {
    const v = state.context[f.id] || "";
    if (!v) return "";
    return `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(v)}</dd>`;
  }).filter(Boolean).join("");

  const scoreRows = DIMENSIONS.map(d => {
    const s = scores.perDimension[d.id];
    return `<tr>
      <td><b>${d.id}</b> — ${escapeHtml(d.name)}</td>
      <td>${escapeHtml(d.question)}</td>
      <td class="pr-score-cell">${s.score.toFixed(2)}</td>
    </tr>`;
  }).join("");

  const tripwireBlock = scores.tripwires.length ? `
    <div class="pr-tripwires">
      <h3>Tripwires triggered (${scores.tripwires.length})</h3>
      <ul>
        ${scores.tripwires.map(t => `<li><b>${escapeHtml(t.qid)}</b> (${escapeHtml(t.dimName)}): ${escapeHtml(t.prompt)} — "${escapeHtml(t.answer)}"</li>`).join("")}
      </ul>
    </div>
  ` : "";

  const dimTables = DIMENSIONS.map(d => {
    const rows = d.questions.map(q => {
      const idx = state.answers[q.id];
      const opt = idx != null ? q.options[idx] : null;
      const evid = state.evidence[q.id] || "";
      const tw = opt && opt.tripwire;
      return `<tr class="${tw ? "pr-tw" : ""}">
        <td class="pr-q"><b>${escapeHtml(q.id)}</b> · ${escapeHtml(q.prompt)}</td>
        <td class="pr-a">${opt ? escapeHtml(opt.label) : "<i>no answer</i>"}${tw ? " · <b>tripwire</b>" : ""}</td>
        <td class="pr-r">${opt ? opt.risk : "—"}</td>
        <td class="pr-n">${escapeHtml(evid)}</td>
      </tr>`;
    }).join("");
    return `
      <div class="pr-dimension">
        <h3>${d.id}. ${escapeHtml(d.name)}</h3>
        <p class="pr-dim-question">${escapeHtml(d.question)}</p>
        <table class="pr-answers">
          <thead><tr><th class="pr-q">Question</th><th class="pr-a">Answer</th><th class="pr-r">Risk</th><th class="pr-n">Evidence / notes</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const recs = recommendationsFor(scores, state);

  host.innerHTML = `
    <div class="pr-header">
      <h1>A.G.E.N.T. Risk Assessment</h1>
      <p class="pr-sub">Pre-deployment checklist for agentic AI · Framework v${escapeHtml(FRAMEWORK_VERSION)}</p>
      <div class="pr-meta">
        <span><b>Agent:</b> ${escapeHtml(state.context.agent_name || "—")}</span>
        <span><b>Assessor:</b> ${escapeHtml(state.context.assessor || "—")}</span>
        <span><b>Date:</b> ${escapeHtml(state.context.assessment_date || new Date().toISOString().slice(0, 10))}</span>
      </div>
    </div>

    <div class="pr-verdict">
      <span class="pr-vbadge" style="color:${meta.color}">${meta.label}</span>
      <div class="pr-vtext">
        <b>${escapeHtml(meta.desc)}</b><br/>
        Overall risk: ${scores.overall?.toFixed(2) ?? "—"}/4 · ${escapeHtml(scores.reasoning.join(" "))}
      </div>
    </div>

    ${ctxItems ? `<h2>Context</h2><div class="pr-context"><dl>${ctxItems}</dl></div>` : ""}

    ${state.context.top_attack_vectors ? `
      <h2>Top attack vectors (documented by assessor)</h2>
      <div class="pr-context"><dd style="margin:0;white-space:pre-wrap">${escapeHtml(state.context.top_attack_vectors)}</dd></div>
    ` : ""}

    <h2>Dimension scores</h2>
    <table class="pr-scores">
      <thead><tr><th>Dimension</th><th>Framing question</th><th class="pr-score-cell">Score</th></tr></thead>
      <tbody>${scoreRows}</tbody>
    </table>

    ${tripwireBlock ? `<h2>Tripwires</h2>${tripwireBlock}` : ""}

    <h2>Detailed answers</h2>
    ${dimTables}

    <h2>Recommended next steps</h2>
    <div class="pr-recs"><ol>${recs.map(r => `<li>${escapeHtml(r)}</li>`).join("")}</ol></div>

    <div class="pr-audit">
      <span>Framework: A.G.E.N.T. v${escapeHtml(FRAMEWORK_VERSION)}</span>
      <span>Generated: ${new Date().toISOString().replace(".000Z", "Z")}</span>
      <span>Content hash (SHA-256 of canonical answers): ${hashHex || "(unsupported by browser)"}</span>
      <span>This report was produced entirely client-side. No data was transmitted.</span>
    </div>
  `;
}

/* --- Recommendations --------------------------------------------------- */

function recommendationsFor(scores, state) {
  const recs = [];
  if (scores.tripwires.length > 0) {
    recs.push(`Resolve ${scores.tripwires.length} tripwire answer${scores.tripwires.length === 1 ? "" : "s"} before any further review — these single answers force a BLOCK regardless of the aggregate score.`);
  }
  // Dimension-targeted advice when a dimension scores >= 2.0
  const dimAdvice = {
    A: "Rebuild the tool/credential inventory and enforce default-deny. Strip scopes until you can name every capability the agent uses in a sentence.",
    G: "Name a single accountable owner with a backup. Document retirement criteria and rehearse the kill-switch this quarter.",
    E: "Wrap destructive, financial, IAM, and external-comms actions with human approval. The engineer's click is cheaper than the recovery.",
    N: "Pin every third-party component, subscribe to CVE feeds, and demand an ABOM from each vendor. Remove any open-marketplace auto-update.",
    T: "Map each remaining risk to OWASP LLM Top 10 and MITRE ATLAS. If the team cannot list five attack vectors on demand, the agent is not ready."
  };
  for (const d of DIMENSIONS) {
    const s = scores.perDimension[d.id].score;
    if (s >= 2.0) recs.push(`${d.id} — ${d.name}: ${dimAdvice[d.id]}`);
  }
  if (scores.verdict === "DEPLOY") {
    recs.push("Proceed with standard monitoring and quarterly re-assessment. Subscribe owners to CVE feeds for all pinned dependencies.");
  } else if (scores.verdict === "GATE") {
    recs.push("Ship behind guardrails: HITL on every sensitive action, weekly behavioural review, dedicated security oversight.");
  } else {
    recs.push("Do not deploy. Redesign the agent's scope, strip permissions, and re-run A.G.E.N.T. before a security sign-off.");
  }
  if (recs.length === 0) recs.push("Maintain current controls and re-assess quarterly or whenever the agent gains a new tool, model, or data source.");
  return recs;
}
