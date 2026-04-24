/* App wiring: state, rendering, events. No globals polluted beyond what the
   other files define. */

(function () {
  let state = loadState();
  let currentView = "assess";

  /* ---------- Render: assessment form ---------- */

  function renderContextFields() {
    const host = document.getElementById("context-fields");
    if (!host) return;
    host.innerHTML = CONTEXT_FIELDS.map(f => {
      const val = state.context[f.id] || "";
      const full = f.multiline ? "full" : "";
      const input = f.multiline
        ? `<textarea id="ctx-${f.id}" data-ctx="${f.id}" placeholder="${escapeAttr(f.placeholder || "")}">${escapeHtml(val)}</textarea>`
        : `<input id="ctx-${f.id}" data-ctx="${f.id}" type="${f.type || "text"}" value="${escapeAttr(val)}" placeholder="${escapeAttr(f.placeholder || "")}" />`;
      return `
        <div class="ctx-field ${full}">
          <label for="ctx-${f.id}">${escapeHtml(f.label)}</label>
          ${input}
        </div>
      `;
    }).join("");
  }

  function renderDimensions() {
    const host = document.getElementById("dimensions");
    if (!host) return;
    host.innerHTML = DIMENSIONS.map(dim => {
      const answered = dim.questions.filter(q => state.answers[q.id] != null).length;
      return `
        <section class="dimension" id="dim-${dim.id}" aria-labelledby="dim-${dim.id}-title">
          <header class="dimension-head">
            <div class="dim-letter" aria-hidden="true">${dim.id}</div>
            <div class="dim-title">
              <h3 id="dim-${dim.id}-title">${escapeHtml(dim.name)}</h3>
              <p class="dim-question">${escapeHtml(dim.question)}</p>
              <p class="dim-blurb">${escapeHtml(dim.blurb)}</p>
            </div>
            <div class="dim-status" id="dim-${dim.id}-status">${answered}/${dim.questions.length}</div>
          </header>
          <div class="questions">
            ${dim.questions.map(q => renderQuestion(q)).join("")}
          </div>
        </section>
      `;
    }).join("");
  }

  function renderQuestion(q) {
    const selected = state.answers[q.id];
    const evid = state.evidence[q.id] || "";
    const opts = q.options.map((opt, i) => {
      const isSelected = selected === i;
      const isTrip = !!opt.tripwire;
      return `
        <label class="option ${isSelected ? "is-selected" : ""} ${isTrip ? "is-tripwire" : ""}" data-risk="${opt.risk}">
          <input type="radio" name="${q.id}" value="${i}" ${isSelected ? "checked" : ""} data-qid="${q.id}" />
          <span class="option-label">${escapeHtml(opt.label)}${isTrip ? ' <b style="color:#b3261e">· tripwire</b>' : ""}</span>
          <span class="option-risk">risk ${opt.risk}</span>
        </label>
      `;
    }).join("");
    return `
      <div class="question" id="q-${q.id}">
        <div class="q-head">
          <div class="q-prompt"><span class="muted" style="font-family:var(--font-mono);font-size:12px;margin-right:6px">${q.id}</span>${escapeHtml(q.prompt)}</div>
          <div class="q-help">${escapeHtml(q.help)}</div>
        </div>
        <div class="options" role="radiogroup" aria-label="${escapeAttr(q.prompt)}">${opts}</div>
        <details class="evidence" ${evid ? "open" : ""}>
          <summary>Evidence / notes ${evid ? "· filled" : "(optional)"}</summary>
          <textarea data-evid="${q.id}" placeholder="Link to runbook, ticket, ABOM row, control owner. Keeps the assessment auditable.">${escapeHtml(evid)}</textarea>
        </details>
      </div>
    `;
  }

  function escapeAttr(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  /* ---------- Progress & dimension status ---------- */

  function totalQuestions() {
    return DIMENSIONS.reduce((s, d) => s + d.questions.length, 0);
  }

  function updateProgress() {
    const total = totalQuestions();
    const answered = Object.keys(state.answers).filter(k => state.answers[k] != null).length;
    const fill = document.getElementById("progress-fill");
    if (fill) fill.style.width = `${(answered / total) * 100}%`;
    const ac = document.getElementById("answered-count"); if (ac) ac.textContent = String(answered);
    const at = document.getElementById("answered-total"); if (at) at.textContent = String(total);
    // Per-dimension counter update
    for (const d of DIMENSIONS) {
      const n = d.questions.filter(q => state.answers[q.id] != null).length;
      const el = document.getElementById(`dim-${d.id}-status`);
      if (el) el.textContent = `${n}/${d.questions.length}`;
    }
  }

  /* ---------- Navigation ---------- */

  function showView(name) {
    currentView = name;
    for (const v of document.querySelectorAll(".view")) v.classList.toggle("is-active", v.id === `view-${name}`);
    for (const b of document.querySelectorAll(".nav-btn")) b.classList.toggle("is-active", b.dataset.view === name);
    if (name === "dashboard") refreshDashboard();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function refreshDashboard() {
    const scores = computeScores(state.answers);
    const hash = await computeHash(state);
    renderDashboard(state, scores, hash);
  }

  /* ---------- Events ---------- */

  function onAnswerChange(e) {
    const t = e.target;
    if (t.matches("input[type=radio][data-qid]")) {
      const qid = t.dataset.qid;
      state.answers[qid] = Number(t.value);
      state.updated = new Date().toISOString();
      saveState(state);
      // Update just this question's option selection styling
      const group = t.closest(".options");
      if (group) {
        for (const lab of group.querySelectorAll(".option")) lab.classList.remove("is-selected");
        const selectedLab = t.closest(".option");
        if (selectedLab) selectedLab.classList.add("is-selected");
      }
      updateProgress();
    } else if (t.matches("[data-ctx]")) {
      state.context[t.dataset.ctx] = t.value;
      state.updated = new Date().toISOString();
      saveState(state);
    } else if (t.matches("[data-evid]")) {
      state.evidence[t.dataset.evid] = t.value;
      state.updated = new Date().toISOString();
      saveState(state);
      // Update summary label
      const details = t.closest("details");
      if (details) {
        const sum = details.querySelector("summary");
        if (sum) sum.textContent = `Evidence / notes ${t.value ? "· filled" : "(optional)"}`;
      }
    }
  }

  function onClick(e) {
    const t = e.target.closest("[data-action], [data-view]");
    if (!t) return;
    const action = t.dataset.action;
    const view = t.dataset.view;

    if (view) {
      showView(view);
      return;
    }

    switch (action) {
      case "view-dashboard":
        showView("dashboard");
        break;
      case "view-assess":
        showView("assess");
        break;
      case "reset":
        if (confirm("Reset this assessment? Answers and evidence notes will be removed from this browser.")) {
          state = emptyState();
          state.context.assessment_date = new Date().toISOString().slice(0, 10);
          saveState(state);
          renderContextFields();
          renderDimensions();
          updateProgress();
          showView("assess");
        }
        break;
      case "load-demo":
        if (Object.keys(state.answers).length > 0 || Object.values(state.context).some(v => v)) {
          if (!confirm("Replace the current assessment with demo data? Export your current answers first if you want to keep them.")) break;
        }
        state = {
          version: FRAMEWORK_VERSION,
          context: { ...DEMO_ASSESSMENT.context },
          answers: { ...DEMO_ASSESSMENT.answers },
          evidence: { ...DEMO_ASSESSMENT.evidence },
          updated: new Date().toISOString()
        };
        saveState(state);
        renderContextFields();
        renderDimensions();
        updateProgress();
        showView("dashboard");
        break;
      case "print":
        // Ensure dashboard is rendered + active before printing.
        showView("dashboard");
        setTimeout(() => window.print(), 80);
        break;
      case "export-csv": {
        const csv = buildAssessmentCsv(state);
        const name = (state.context.agent_name || "agent").replace(/[^a-z0-9._-]+/gi, "_");
        const date = new Date().toISOString().slice(0, 10);
        downloadBlob(`agent-assessment-${name}-${date}.csv`, csv, "text/csv;charset=utf-8");
        break;
      }
      case "download-template":
        downloadBlob("agent-assessment-template.csv", buildTemplateCsv(), "text/csv;charset=utf-8");
        break;
      case "clear-data":
        if (confirm("Clear all saved data from this browser? Cannot be undone.")) {
          clearState();
          state = emptyState();
          renderContextFields();
          renderDimensions();
          updateProgress();
          showView("assess");
        }
        break;
    }
  }

  function onImport(e) {
    const f = e.target.files && e.target.files[0];
    const status = document.getElementById("import-status");
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { context, answers, evidence } = importAssessmentCsv(String(reader.result || ""));
        state = { version: FRAMEWORK_VERSION, context, answers, evidence, updated: new Date().toISOString() };
        saveState(state);
        renderContextFields();
        renderDimensions();
        updateProgress();
        if (status) status.textContent = `Loaded ${Object.keys(answers).length} answers from ${f.name}.`;
        showView("assess");
      } catch (err) {
        if (status) status.textContent = `Could not import: ${err.message}`;
      } finally {
        e.target.value = "";
      }
    };
    reader.onerror = () => { if (status) status.textContent = "Could not read file."; };
    reader.readAsText(f);
  }

  /* ---------- Init ---------- */

  function init() {
    const vt = document.getElementById("version-tag");
    if (vt) vt.textContent = `v${FRAMEWORK_VERSION}`;

    // Auto-fill today's date if empty (CISO reports should never be undated).
    if (!state.context.assessment_date) {
      state.context.assessment_date = new Date().toISOString().slice(0, 10);
      saveState(state);
    }

    renderContextFields();
    renderDimensions();
    updateProgress();

    document.addEventListener("change", onAnswerChange);
    document.addEventListener("input", onAnswerChange);
    document.addEventListener("click", onClick);
    const imp = document.getElementById("import-file");
    if (imp) imp.addEventListener("change", onImport);

    const verify = document.getElementById("verify-local");
    if (verify) verify.addEventListener("click", (e) => {
      e.preventDefault();
      alert(
        "Verify this tool is offline:\n\n" +
        "1. Open browser DevTools → Network tab.\n" +
        "2. Check 'Disable cache' and reload.\n" +
        "3. Answer questions, export CSV, print to PDF.\n" +
        "4. Confirm the Network tab shows only same-origin requests (no cross-origin fetches, no XHR, no beacons).\n\n" +
        "All data is in localStorage on this machine only."
      );
    });

    // If the URL has #dashboard, open the dashboard view
    if (location.hash === "#dashboard") showView("dashboard");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
