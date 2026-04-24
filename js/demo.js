/* Demo data — a realistic mid-risk agent scenario that produces a GATE verdict
   with a couple of tripwire near-misses, so the dashboard shows off all sections. */

const DEMO_ASSESSMENT = {
  context: {
    agent_name: "SupportTriageBot v2",
    agent_purpose: "Classifies inbound customer support emails, drafts first-pass replies, and routes high-priority tickets to on-call agents.",
    assessor: "Jordan Patel, Senior Security Engineer",
    assessment_date: new Date().toISOString().slice(0, 10),
    top_attack_vectors:
`1. Prompt injection via inbound customer email (OWASP LLM01 / MITRE ATLAS AML.T0051).
2. Data exfiltration through drafted replies that include internal runbook snippets.
3. Memory poisoning via the persistent ticket-context vector store.
4. Third-party MCP plugin compromise for the Zendesk connector (OWASP LLM03).
5. Reward-hacking in online fine-tune loop that incentivises "resolved" status.`
  },
  /* Mix of answers: mostly 1-2 (moderate), with a couple of higher risks in T
     to produce a GATE verdict and surface multiple findings. No tripwires — the
     dashboard should show "GATE" with real reasoning. */
  answers: {
    A1: 1, A2: 2, A3: 3, A4: 1, A5: 1,   // Access: moderate, writes to prod-adjacent, customer PII in scope
    G1: 1, G2: 1, G3: 2, G4: 1, G5: 2,   // Governance: single named owner, playbook but untested kill-switch
    E1: 1, E2: 0, E3: 1, E4: 2, E5: 1,   // Execution: external send gated, no destructive/financial
    N1: 2, N2: 1, N3: 1, N4: 0, N5: 1,   // Network: moderate plugin count, pinned, pinned model
    T1: 3, T2: 2, T3: 3, T4: 1, T5: 2    // Threat: reads untrusted email (sanitized), persistent memory, writes org-wide
  },
  evidence: {
    A3: "Zendesk connector scopes include customer email, order history. Not card data.",
    E4: "All external sends queued for human approval via the SupportOps Slack channel.",
    G5: "IR playbook in Confluence; kill-switch is `kill-switch.sh` but has not been drilled.",
    T1: "Sanitizer layer is PromptArmor v0.3. Coverage of MITRE ATLAS AML.T0051 variants is documented at 78%.",
    T2: "Pinecone index, per-tenant namespace. Writes on human approval only.",
    T3: "Writes summaries into the org-wide knowledge base. Blast-radius assessment pending.",
    T5: "Five vectors listed and mapped to OWASP LLM; mitigations drafted but not all operational.",
    N1: "Zendesk MCP, Jira MCP, internal knowledge-base MCP. Versions pinned in manifest v2.1."
  }
};
