/* A.G.E.N.T. Risk Framework — question bank, scoring rules, decision engine.
   All logic is data-driven so the framework can be audited in one file. */

const FRAMEWORK_VERSION = "1.0.0";

/* Scoring: each answer carries a `risk` value 0..4.
   0 = low risk, 4 = critical. Per-dimension score = average of its 5 answers.
   An answer may also set `tripwire: true` — a single tripwire forces BLOCK.
*/

const DIMENSIONS = [
  {
    id: "A",
    name: "Access Scope",
    question: "What systems, data, and tools does this agent reach?",
    blurb: "Enumerate every tool, API, credential, data store. Default-deny beats default-allow.",
    questions: [
      {
        id: "A1",
        prompt: "Tool & credential inventory",
        help: "Have you enumerated every tool, API, credential, data store, email account, and shell the agent can reach?",
        options: [
          { label: "Complete written inventory, reviewed this quarter", risk: 0 },
          { label: "Documented but > 1 quarter old", risk: 1 },
          { label: "Partial — known unknowns remain", risk: 2 },
          { label: "Informal / tribal knowledge only", risk: 3 },
          { label: "No inventory (\"the usual dev setup\")", risk: 4, tripwire: true }
        ]
      },
      {
        id: "A2",
        prompt: "Privilege level on reachable systems",
        help: "Highest privilege the agent holds on any reachable system.",
        options: [
          { label: "Read-only on non-sensitive data", risk: 0 },
          { label: "Scoped write on a single non-prod service", risk: 1 },
          { label: "Scoped write on production", risk: 2 },
          { label: "Broad write / admin on multiple services", risk: 3 },
          { label: "Effective root / full IAM / full Terraform", risk: 4, tripwire: true }
        ]
      },
      {
        id: "A3",
        prompt: "Sensitivity of reachable data",
        help: "Most sensitive data class the agent can read or write.",
        options: [
          { label: "Public data only", risk: 0 },
          { label: "Internal, non-confidential", risk: 1 },
          { label: "Confidential business data", risk: 2 },
          { label: "Customer PII or financial records", risk: 3 },
          { label: "Regulated (PHI / payment card / secrets / source code at scale)", risk: 4 }
        ]
      },
      {
        id: "A4",
        prompt: "Default policy",
        help: "Does the configuration default-deny, with explicit allowlists per tool?",
        options: [
          { label: "Default-deny, per-tool allowlist, reviewed", risk: 0 },
          { label: "Default-deny, allowlist not reviewed recently", risk: 1 },
          { label: "Mixed — some scopes default-allow", risk: 2 },
          { label: "Default-allow with blocklist", risk: 3 },
          { label: "No policy — whatever the SDK exposes", risk: 4, tripwire: true }
        ]
      },
      {
        id: "A5",
        prompt: "Secrets handling",
        help: "How are credentials provisioned and rotated for this agent?",
        options: [
          { label: "Short-lived, per-session tokens from a vault, auto-rotated", risk: 0 },
          { label: "Vault-issued long-lived tokens, rotated on schedule", risk: 1 },
          { label: "Long-lived tokens in managed config", risk: 2 },
          { label: "Static keys in env files or repo secrets", risk: 3 },
          { label: "Shared service account credentials passed through prompts", risk: 4, tripwire: true }
        ]
      }
    ]
  },
  {
    id: "G",
    name: "Governance Model",
    question: "Who owns, monitors, and is accountable for this agent?",
    blurb: "Name a person, a team, an on-call rotation, a retirement trigger.",
    questions: [
      {
        id: "G1",
        prompt: "Named human owner",
        help: "Is there a single accountable individual (not a team distribution list)?",
        options: [
          { label: "Named individual + named backup, both on-call", risk: 0 },
          { label: "Named individual, no backup", risk: 1 },
          { label: "Team DL owns it", risk: 2 },
          { label: "\"The AI team\" or \"IT\"", risk: 3 },
          { label: "No owner identified", risk: 4, tripwire: true }
        ]
      },
      {
        id: "G2",
        prompt: "Monitoring & alerting",
        help: "Actions are logged, reviewable, and trigger alerts on anomalies.",
        options: [
          { label: "Full action log + anomaly alerts tied to on-call", risk: 0 },
          { label: "Action log + periodic review", risk: 1 },
          { label: "Action log, no review cadence", risk: 2 },
          { label: "Partial logs (prompts only, or tool calls only)", risk: 3 },
          { label: "No structured logging of agent actions", risk: 4 }
        ]
      },
      {
        id: "G3",
        prompt: "Documented lifecycle",
        help: "Retirement criteria, capability-expansion approval, red-team cadence.",
        options: [
          { label: "All three documented and enforced", risk: 0 },
          { label: "Two of three", risk: 1 },
          { label: "One of three", risk: 2 },
          { label: "Discussed informally, not written", risk: 3 },
          { label: "None — agent ships and stays forever", risk: 4 }
        ]
      },
      {
        id: "G4",
        prompt: "Change-control for prompts / tools / models",
        help: "Changes to the system prompt, tool set, or model version go through review.",
        options: [
          { label: "Code-review + security sign-off on any change", risk: 0 },
          { label: "Code-review, no security sign-off", risk: 1 },
          { label: "Code-review on tool changes only", risk: 2 },
          { label: "Ad-hoc edits by owners", risk: 3 },
          { label: "Anyone with access can edit live", risk: 4, tripwire: true }
        ]
      },
      {
        id: "G5",
        prompt: "Incident response playbook",
        help: "Named responders, kill-switch, evidence capture, post-mortem flow.",
        options: [
          { label: "Playbook + drilled kill-switch in the last quarter", risk: 0 },
          { label: "Playbook + untested kill-switch", risk: 1 },
          { label: "Kill-switch exists, no playbook", risk: 2 },
          { label: "Generic corporate IR, nothing agent-specific", risk: 3 },
          { label: "No kill-switch, no playbook", risk: 4, tripwire: true }
        ]
      }
    ]
  },
  {
    id: "E",
    name: "Execution Authority",
    question: "What can it do autonomously vs. what requires human approval?",
    blurb: "Destructive, financial, IAM, and external-comms actions should be gated. Always.",
    questions: [
      {
        id: "E1",
        prompt: "Destructive operations",
        help: "Deletes, drops, destroys, rm -rf, terraform destroy, snapshot removal.",
        options: [
          { label: "Capability not present", risk: 0 },
          { label: "Requires two-person approval", risk: 1 },
          { label: "Requires single human approval", risk: 2 },
          { label: "Autonomous in non-prod only, blocked in prod", risk: 3 },
          { label: "Autonomous in production", risk: 4, tripwire: true }
        ]
      },
      {
        id: "E2",
        prompt: "Financial or payment actions",
        help: "Moving money, purchasing, refunds, invoicing.",
        options: [
          { label: "Capability not present", risk: 0 },
          { label: "Requires approval + per-txn cap", risk: 1 },
          { label: "Requires approval, no cap", risk: 2 },
          { label: "Autonomous within low cap", risk: 3 },
          { label: "Autonomous, no cap", risk: 4, tripwire: true }
        ]
      },
      {
        id: "E3",
        prompt: "IAM / access changes",
        help: "Granting roles, creating users, changing permissions.",
        options: [
          { label: "Capability not present", risk: 0 },
          { label: "Read-only on IAM", risk: 1 },
          { label: "Write with multi-party approval", risk: 2 },
          { label: "Write with single approval", risk: 3 },
          { label: "Autonomous IAM changes", risk: 4, tripwire: true }
        ]
      },
      {
        id: "E4",
        prompt: "External communications",
        help: "Email, SMS, chat, social posts, forum replies, calls out of the company.",
        options: [
          { label: "No external send capability", risk: 0 },
          { label: "Allowlist of external recipients + human approval", risk: 1 },
          { label: "Human approval, no recipient allowlist", risk: 2 },
          { label: "Autonomous within a template", risk: 3 },
          { label: "Free-form autonomous external send", risk: 4, tripwire: true }
        ]
      },
      {
        id: "E5",
        prompt: "Rollback / undo",
        help: "Can actions be reverted? Is there a blast-radius limit?",
        options: [
          { label: "All actions reversible + per-session blast-radius cap", risk: 0 },
          { label: "Most actions reversible, cap enforced", risk: 1 },
          { label: "Some reversible, no cap", risk: 2 },
          { label: "Reversibility depends on timing (snapshots)", risk: 3 },
          { label: "Irreversible actions allowed, no cap", risk: 4 }
        ]
      }
    ]
  },
  {
    id: "N",
    name: "Network of Trust",
    question: "What agents, services, and users does it interact with?",
    blurb: "Your posture = transitive closure of your dependencies. Inventory, pin, scan.",
    questions: [
      {
        id: "N1",
        prompt: "Third-party MCP servers / plugins / skills",
        help: "Count and provenance of third-party components the agent loads.",
        options: [
          { label: "None — only first-party tools", risk: 0 },
          { label: "≤ 3, vetted vendors, pinned versions", risk: 1 },
          { label: "Moderate (4–10), mixed provenance", risk: 2 },
          { label: "Many (> 10), community plugins enabled", risk: 3 },
          { label: "Open marketplace with auto-update", risk: 4, tripwire: true }
        ]
      },
      {
        id: "N2",
        prompt: "Version pinning and integrity",
        help: "Pinned versions, lockfiles, signed artefacts, SBOM/ABOM.",
        options: [
          { label: "Pinned + signed + SBOM + ABOM", risk: 0 },
          { label: "Pinned + lockfile, no signing", risk: 1 },
          { label: "Floating minor versions", risk: 2 },
          { label: "Latest on deploy", risk: 3 },
          { label: "Live auto-update from registry", risk: 4, tripwire: true }
        ]
      },
      {
        id: "N3",
        prompt: "Model provenance",
        help: "Where do the LLM(s) come from? Who signs the weights?",
        options: [
          { label: "Enterprise-hosted, contracted model with signed weights", risk: 0 },
          { label: "Major provider API, pinned version", risk: 1 },
          { label: "Major provider API, floating version", risk: 2 },
          { label: "Open-weights model from a trusted hub", risk: 3 },
          { label: "Arbitrary community model, unverified", risk: 4 }
        ]
      },
      {
        id: "N4",
        prompt: "Agent-to-agent delegation",
        help: "Does this agent call other agents? Can those agents act on its behalf?",
        options: [
          { label: "No delegation", risk: 0 },
          { label: "Delegates within same trust boundary only", risk: 1 },
          { label: "Delegates to internal agents across teams", risk: 2 },
          { label: "Delegates to partner / vendor agents", risk: 3 },
          { label: "Delegates to arbitrary discovered agents", risk: 4, tripwire: true }
        ]
      },
      {
        id: "N5",
        prompt: "Supply-chain monitoring",
        help: "CVE feeds, dependency alerts, runtime anomaly detection on third-party calls.",
        options: [
          { label: "CVE feeds + runtime anomaly detection + subscription alerts", risk: 0 },
          { label: "CVE feeds + dependency bot", risk: 1 },
          { label: "Dependency bot only", risk: 2 },
          { label: "Manual quarterly review", risk: 3 },
          { label: "No monitoring", risk: 4 }
        ]
      }
    ]
  },
  {
    id: "T",
    name: "Threat Surface",
    question: "What are the specific attack vectors for this agent's configuration?",
    blurb: "Map choices to OWASP LLM Top 10 and MITRE ATLAS. List the top five attack vectors.",
    questions: [
      {
        id: "T1",
        prompt: "Untrusted input exposure (prompt injection)",
        help: "Does it read emails, documents, web pages, tickets, PRs from untrusted parties? OWASP LLM01, ATLAS AML.T0051.",
        options: [
          { label: "Only structured input from trusted services", risk: 0 },
          { label: "Internal docs authored by employees", risk: 1 },
          { label: "Customer-provided content in controlled channels", risk: 2 },
          { label: "Arbitrary email / web content, sanitized", risk: 3 },
          { label: "Arbitrary untrusted input, no sanitization layer", risk: 4, tripwire: true }
        ]
      },
      {
        id: "T2",
        prompt: "Persistent memory / vector store (memory poisoning)",
        help: "Does it write to long-term memory that influences future sessions?",
        options: [
          { label: "No persistent memory", risk: 0 },
          { label: "Persistent memory, read-only to agent", risk: 1 },
          { label: "Write-on-approval into isolated-per-user memory", risk: 2 },
          { label: "Shared memory across users, owner-curated", risk: 3 },
          { label: "Shared memory, agent-writable, auto-ingested", risk: 4, tripwire: true }
        ]
      },
      {
        id: "T3",
        prompt: "Shared-resource writes (lateral movement)",
        help: "Writes to shared repos, shared buckets, shared channels, shared databases.",
        options: [
          { label: "Writes only to isolated, per-session resources", risk: 0 },
          { label: "Writes to owner-scoped shared resources", risk: 1 },
          { label: "Writes to team-shared resources", risk: 2 },
          { label: "Writes to org-wide shared resources", risk: 3 },
          { label: "Writes to cross-org / cross-tenant resources", risk: 4, tripwire: true }
        ]
      },
      {
        id: "T4",
        prompt: "Reward-hacking / goal-misgeneralization risk",
        help: "Is the agent optimized against metrics it can influence (training, RL, self-improvement)?",
        options: [
          { label: "No optimization loop on live systems", risk: 0 },
          { label: "Offline eval only, human-scored", risk: 1 },
          { label: "Online A/B with guardrails and kill-switch", risk: 2 },
          { label: "Online RL with automated reward", risk: 3 },
          { label: "Online RL with resource-level rewards (compute, revenue)", risk: 4, tripwire: true }
        ]
      },
      {
        id: "T5",
        prompt: "Top-5 attack vectors documented",
        help: "Can the team list the five most likely attack vectors, each mapped to OWASP LLM or MITRE ATLAS?",
        options: [
          { label: "All five listed, mapped, with mitigations", risk: 0 },
          { label: "All five listed, mapped, mitigations partial", risk: 1 },
          { label: "Listed, not mapped", risk: 2 },
          { label: "Team can name two or three on the spot", risk: 3 },
          { label: "Team cannot list them", risk: 4, tripwire: true }
        ]
      }
    ]
  }
];

/* Free-text questions collected outside the scoring grid. */
const CONTEXT_FIELDS = [
  { id: "agent_name", label: "Agent name", placeholder: "e.g. SupportTriageBot v2" },
  { id: "agent_purpose", label: "Purpose / business use", placeholder: "One sentence.", multiline: true },
  { id: "assessor", label: "Assessor (you)", placeholder: "Name, role" },
  { id: "assessment_date", label: "Assessment date", placeholder: "YYYY-MM-DD", type: "date" },
  { id: "top_attack_vectors", label: "Top-5 attack vectors (free text)", placeholder: "1. Prompt injection via support email (OWASP LLM01)\n2. ...", multiline: true }
];

/* Decision engine */
function computeScores(answers) {
  const perDimension = {};
  let overallSum = 0, overallCount = 0;
  const triggeredTripwires = [];

  for (const dim of DIMENSIONS) {
    let sum = 0, count = 0;
    for (const q of dim.questions) {
      const a = answers[q.id];
      if (a == null) continue;
      const opt = q.options[a];
      if (!opt) continue;
      sum += opt.risk;
      count += 1;
      overallSum += opt.risk;
      overallCount += 1;
      if (opt.tripwire) {
        triggeredTripwires.push({ dim: dim.id, dimName: dim.name, qid: q.id, prompt: q.prompt, answer: opt.label });
      }
    }
    perDimension[dim.id] = {
      id: dim.id,
      name: dim.name,
      score: count > 0 ? sum / count : null,
      answered: count,
      total: dim.questions.length
    };
  }

  const overall = overallCount > 0 ? overallSum / overallCount : null;
  const complete = overallCount === DIMENSIONS.reduce((s, d) => s + d.questions.length, 0);

  let verdict = "DEPLOY";
  let reasoning = [];

  if (triggeredTripwires.length > 0) {
    verdict = "BLOCK";
    reasoning.push(`${triggeredTripwires.length} tripwire${triggeredTripwires.length === 1 ? "" : "s"} triggered — any single tripwire forces BLOCK.`);
    if (overall != null) reasoning.push(`Overall risk is ${overall.toFixed(2)}/4 for reference.`);
  } else {
    const maxDim = Math.max(...Object.values(perDimension).map(d => d.score ?? 0));
    if (overall != null && (overall >= 2.5 || maxDim >= 3.0)) {
      verdict = "BLOCK";
      reasoning.push(`Overall risk ${overall.toFixed(2)} and peak dimension risk ${maxDim.toFixed(2)} exceed BLOCK thresholds.`);
    } else if (overall != null && (overall >= 1.5 || maxDim >= 2.0)) {
      verdict = "GATE";
      reasoning.push(`Overall risk ${overall.toFixed(2)} and peak dimension risk ${maxDim.toFixed(2)} exceed DEPLOY thresholds.`);
    } else if (overall != null) {
      reasoning.push(`Overall risk ${overall.toFixed(2)} with all dimensions below gating thresholds.`);
    }
  }

  return {
    perDimension,
    overall,
    verdict,
    reasoning,
    tripwires: triggeredTripwires,
    complete
  };
}

function verdictMeta(v) {
  switch (v) {
    case "DEPLOY": return { label: "DEPLOY", color: "#1f8a4c", desc: "Standard monitoring, quarterly audit, regular access review." };
    case "GATE":   return { label: "GATE",   color: "#c77d0a", desc: "Enhanced guardrails, HITL on sensitive actions, weekly behavioural review." };
    case "BLOCK":  return { label: "BLOCK",  color: "#b3261e", desc: "Do not deploy. Redesign scope, strip permissions, re-assess." };
  }
}
