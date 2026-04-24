# A.G.E.N.T. Risk Framework — Self-Assessment Tool

An interactive pre-deployment checklist for AI agents, based on the **A.G.E.N.T.** framework:

- **A**ccess Scope — what systems, data, and tools does this agent reach?
- **G**overnance Model — who owns, monitors, and is accountable for this agent?
- **E**xecution Authority — what can it do autonomously vs. what requires human approval?
- **N**etwork of Trust — what agents, services, and users does it interact with?
- **T**hreat Surface — what are the specific attack vectors for this agent's configuration?

The tool produces one of three verdicts — **Deploy**, **Gate**, or **Block** — backed by 25 weighted questions, tripwire answers that force a BLOCK, per-question evidence notes, and a tamper-evident hash of the answer set.

## Who it's for

CISOs, Chief AI Officers, security engineers, and AI platform owners who need a repeatable pre-deployment review for agentic AI systems.

## What it does

- **Interactive assessment** — 5 dimensions × 5 questions, each with 5 graded options.
- **Risk dashboard** — verdict badge, radar chart, per-dimension scores, prioritized findings, recommended next steps.
- **PDF report** — use the browser's "Save as PDF" on the dashboard to export a clean, printable assessment with tripwires, detailed answers, evidence, and an audit footer (framework version, timestamp, SHA-256 hash).
- **CSV import / export / template** — keep assessments in your GRC system, share drafts with reviewers, bulk-load from a starter template.
- **Demo data** — load a realistic sample agent (SupportTriageBot v2) with one click to preview the dashboard.

## Privacy & security posture

- **Everything stays in the browser.** No server, no network calls, no cookies, no analytics.
- **Zero third-party JavaScript.** Every script is served from this origin and is auditable.
- **Strict Content-Security-Policy** (`default-src 'self'; connect-src 'none'; frame-ancestors 'none'`). Blocks cross-origin fetches, form posts, and framing.
- **Tamper-evident hash.** The report footer contains a SHA-256 of the canonical answer set.
- **Data you type is persisted to `localStorage` only.** You can clear it at any time from the Data view.

You can verify the privacy posture yourself: open DevTools → Network → disable cache → use the tool. Only same-origin requests should appear.

## Try it

The live tool is available at: **https://dannyliv.github.io/AGENT-Risk-Framework/**

Load the demo from the header or the main Assessment view to see a populated dashboard without filling anything out.

## Install in your organization

### Option A — fork and deploy to your own GitHub Pages (recommended)

1. **Fork** this repository into your org: `https://github.com/YOUR-ORG/AGENT-Risk-Framework`
2. In the fork, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Choose **Branch: `main`**, **Folder: `/ (root)`**, and click **Save**.
5. Wait ~30 seconds. Your tool will be live at `https://YOUR-ORG.github.io/AGENT-Risk-Framework/`.

No build step, no CI, no secrets — it's a static site.

### Option B — clone and host internally

```bash
git clone https://github.com/dannyliv/AGENT-Risk-Framework.git
cd AGENT-Risk-Framework
# Serve with any static server, e.g.:
python3 -m http.server 8080
# then browse to http://localhost:8080/
```

For internal hosting behind SSO (Cloudflare Access, Okta, IAP, etc.), drop the entire directory behind your chosen reverse proxy. The only requirement is that the files are served from the same origin so the CSP allows them.

### Option C — air-gapped / offline

The site works entirely offline once loaded. Download a release zip, unzip, open `index.html` directly in a modern browser (`file://` works for the assessment and CSV export; `window.print()` works in every major browser for PDF export).

## Customizing the framework for your org

Every question, option, risk weight, and tripwire lives in a single file: [`js/framework.js`](js/framework.js). You can safely edit it to:

- Add or remove questions
- Adjust risk weights (`risk: 0..4`)
- Mark additional answers as `tripwire: true` (any tripwire forces BLOCK)
- Change verdict thresholds in `computeScores`

There's no build step — edit, commit, push, done. GitHub Pages re-deploys automatically.

## Scoring and verdicts

- Each answer carries a **risk weight** from **0** (low) to **4** (critical).
- A dimension's score is the average of its five answers.
- The **overall score** is the average of all answered questions.
- A **tripwire** is an answer so severe it forces a BLOCK on its own (e.g. "autonomous destructive operations in production").

Verdicts:

| Verdict | Criteria |
| --- | --- |
| **DEPLOY** | Overall < 1.5 and every dimension < 2.0 |
| **GATE** | Overall < 2.5 and every dimension < 3.0 |
| **BLOCK** | Any tripwire triggered, overall ≥ 2.5, or any dimension ≥ 3.0 |

Full threshold code: [`js/framework.js` → `computeScores`](js/framework.js).

## Repository layout

```
AGENT-Risk-Framework/
├── index.html                 # app shell, assessment, dashboard, data, about
├── css/
│   ├── styles.css             # screen styles (light + dark mode)
│   └── print.css              # PDF / print report layout
├── js/
│   ├── framework.js           # question bank + scoring + decision engine
│   ├── demo.js                # demo agent data
│   ├── storage.js             # localStorage + SHA-256 hashing
│   ├── csv.js                 # import, export, template
│   ├── dashboard.js           # verdict + radar + findings + print-ready report
│   └── app.js                 # state, rendering, events
├── .nojekyll                  # tell GitHub Pages to serve files as-is
├── LICENSE                    # MIT
└── README.md
```

## Browser support

Works in the latest Chrome, Safari, Firefox, and Edge. `SubtleCrypto.digest('SHA-256', ...)` is required for the content hash — available in every modern browser over HTTPS (and on `file://` in most browsers).

## Accessibility

- Keyboard navigable (tab + arrow keys within radio groups).
- Skip-link at the top of the page.
- ARIA labels on radio groups and live regions.
- Color is never the sole risk signal — every severity also shows a number and label.
- Supports `prefers-color-scheme: light` and `dark`.

## Contributing

PRs welcome. The framework is intentionally small — if you'd like to propose new questions, open an issue first so we can keep the set focused.

## Credit

The A.G.E.N.T. framework is described in ["A.G.E.N.T.: A Risk Framework for Deploying Agentic AI"](https://dannylivshits.substack.com/) by Danny Livshits. This tool is an independent implementation of the framework described in that article.

## License

[Apache-2.0](LICENSE). Use it inside your company, fork it, adapt it. No warranty.
