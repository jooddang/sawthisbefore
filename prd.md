PRD: Saw This Before: Automated Issue Triage & Prioritization (for Cursor agents)

1) Overview

Build a GitHub-integrated app that reads new/updated issues and (a) detects duplicates, (b) auto-labels, (c) assigns/ routes to the right owner/team, and (d) outputs a priority score with rationale. Operates in “suggest” mode first (human in the loop), then “auto-apply” above confidence thresholds.

2) Goals / Non-Goals

Goals
	•	Cut human triage time per issue by ≥60%.
	•	Merge/close obvious duplicates automatically (≥80% precision in suggest mode).
	•	Produce consistent labels/assignees within 30s of issue creation/edit.
	•	Provide transparent rationale and links to similar issues.

Non-Goals (v1)
	•	Full bug reproduction.
	•	Cross-tracker support beyond GitHub (Jira, Linear) — optional later.
	•	Vulnerability scanning or CI test triage (out of scope v1).

3) Primary Users & Flows
	•	Maintainers/Triage team: review suggestions, approve/override.
	•	Engineers: receive routed issues, see summary + similar tickets.
	•	PMs: review weekly triage analytics.

High-level flow
	1.	GitHub webhook → ingest event.
	2.	Normalize text (title/body/top comments).
	3.	Vector search for near-dupes → candidate set.
	4.	LLM classifies labels, priority, component; dedup check; owner routing.
	5.	Post single triage comment + apply changes if above thresholds.
	6.	Persist decisions & metrics.

4) Success Metrics (v1)
	•	Mean time from issue open → first triage: <30s.
	•	Maintainer acceptance rate of suggestions: ≥75%.
	•	Duplicate detection F1 (on holdout data): ≥0.8.
	•	Label accuracy (top-k=3): ≥0.85.
	•	SLA: 99.9% uptime for webhook receiver.

⸻

5) System Architecture (Base Infra & Tech Stack)

Runtime
	•	Backend: TypeScript / Node.js (NestJS)
	•	Workers/Orchestration: Temporal.io (preferred) or BullMQ
	•	Admin/UI (optional v1.5): Next.js + Tailwind
	•	DB: Postgres (pgvector) for embeddings + metadata
	•	Search (optional): OpenSearch if we need hybrid lexical/vector
	•	Cache/Queue: Redis
	•	Object store: S3/GCS for embeddings snapshots (optional)
	•	Containers: Docker; deploy to AWS/GCP/Fly.io
	•	Secrets: AWS Secrets Manager / GCP Secret Manager
	•	Observability: OpenTelemetry → Grafana/Cloud Monitoring; structured logs

LLM/Embedding
	•	Embeddings: OpenAI text-embedding-3-large or similar; pluggable.
	•	LLM: Provider-agnostic; start with Claude or GPT-4.1.
	•	Guardrails: JSON schemas; retry/pattern checks.

Security
	•	GitHub App with least-privilege permissions.
	•	Token rotation; per-installation tokens; encryption at rest (KMS).
	•	Full audit log of auto-actions + human overrides.

⸻

6) Required Integrations & APIs

GitHub App (preferred over OAuth)
	•	Webhooks: issues, issue_comment, label, project_v2_item, repository
	•	REST v3 (minimum):
	•	Issues: GET/POST /repos/{owner}/{repo}/issues
	•	Labels: GET/POST /repos/{owner}/{repo}/labels, POST /issues/{number}/labels
	•	Comments: POST /issues/{number}/comments
	•	Assignees: POST /issues/{number}/assignees
	•	Search: GET /search/issues (candidate retrieval)
	•	Projects v2 fields (if used)
	•	GraphQL v4 (batch/complex queries):
	•	Fetch issue nodes (title, body, reactions, labels, timelineItems)
	•	CODEOWNERS-like ownership via teams/paths (if exposed; else local mapping)
	•	Rate limits: handle secondary rate limit; exponential backoff; queue.

(Optional later) Slack
	•	Slash command /triage to preview/apply suggestions.
	•	Events API for notifications.

Internal API (our service)
	•	POST /ingest/github (webhook receiver)
	•	GET /issues/{id}/triage (current suggestion)
	•	POST /issues/{id}/apply (force apply)
	•	GET /analytics/weekly

⸻

7) Data Model (core tables)
	•	repo_installation(id, owner, repo, installation_id, settings_json)
	•	issue(id, repo_id, number, title, body, state, author, created_at, updated_at)
	•	issue_embedding(issue_id, vector, model, ts) (pgvector)
	•	triage_suggestion(id, issue_id, labels[], assignees[], priority_score, duplicate_of?, confidence_json, rationale, created_at)
	•	decision_log(id, issue_id, action, actor, payload_json, created_at)
	•	similar_link(issue_id, similar_issue_id, score)
	•	routing_map(component, team_slug, codeowners_paths[])
	•	metrics_daily(date, repo_id, suggestions, accepted, auto_applied, dupes_closed)

⸻

8) Triage Pipeline (LLM + retrieval)

P0 Signals
	•	Title, body, first N comments, stack trace snippets, version tags, release notes references, reactions, linked PRs, mention density, past reporter history.

Stages
	1.	Ingest & Normalize
	•	Strip boilerplate, code fences retained, extract version/OS.
	2.	Candidate Retrieval (ANN)
	•	Embed (title + body), k-NN via pgvector.
	•	Hybrid boost if same label/version keywords present.
	3.	Near-Dupe Check (LLM gate)
	•	Prompt compares current issue vs top-k candidates → returns duplicate_of (issue id) + confidence.
	4.	Auto-Label (multi-label)
	•	Classifier head (few-shot LLM) + rules from historical labels.
	•	Confidence per label; only apply > threshold; else propose.
	5.	Routing/Assignment
	•	Map component → team (from CODEOWNERS or custom map).
	•	If ambiguous, propose 2 teams with rationale.
	6.	Priority Scoring (deterministic + LLM weighting)
	•	P = w1*Impact + w2*BlastRadius + w3*UserPain + w4*Freshness + w5*ReproEvidence + w6*ReporterTrust
	•	Impact: mentions of crash/data loss, # of watchers/reactions, occurrence keywords.
	•	BlastRadius: core packages/components.
	•	UserPain: “blocking”, “cannot start”, “production”.
	•	Freshness: new release tag referenced.
	•	ReproEvidence: steps, logs, env.
	•	ReporterTrust: reporter’s historical accepted issues ratio.
	•	LLM provides weights; final score clamped 0–100; rationale string.
	7.	Action Layer
	•	Post single triage comment (summary, labels, assignees, priority, dupes).
	•	Apply labels/assignee automatically if confidence ≥ τ.
	•	If duplicate with high confidence, comment and (optionally) close as dupe linking canonical.

Comment template (single post)

🧭 Triage suggestions (v1)
• Labels: [bug, ui] (conf 0.86)
• Assignee/Team: @org/ui-team (conf 0.78)
• Priority: 82/100 — likely crash on startup in v1.8.2
• Possible duplicate(s): #1234 (0.92), #1199 (0.81)
Why: crash keywords + stack trace match; same version tag; reporter history high quality.
Actions: ✅ Apply all | 🎯 Apply labels | 👥 Assign | 🔗 Mark duplicate


⸻

9) Cursor Agents Plan (multi-agent prompts)

Agents
	•	Ingest Agent: cleanse/structure incoming payloads; extract metadata.
	•	Retriever Agent: vector search + lexical; returns top-k with reason.
	•	Dedup Agent: pairwise LLM comparison; outputs canonical match + confidence.
	•	Classifier Agent: propose labels/components; JSON output with confidences.
	•	Router Agent: map to owner/team; cite CODEOWNERS/routing_map evidence.
	•	Prioritizer Agent: compute priority score; return score + rationale.
	•	Supervisor/Orchestrator: merges outputs; enforces thresholds; formats GitHub comment; decides apply vs suggest.

Shared system prompt (all agents)
	•	Always return valid JSON conforming to provided schema.
	•	Provide short rationale (≤50 words).
	•	Never invent issue numbers; only from candidate set.

JSON contracts (abbrev)

// Dedup Agent
{ "duplicate_of": 1234, "confidence": 0.92, "alternates": [1199] , "rationale": "..." }

// Classifier Agent
{ "labels": [{"name":"bug","conf":0.91},{"name":"ui","conf":0.78}], "components":[{"name":"renderer","conf":0.74}], "rationale":"..." }

// Router Agent
{ "assignees": ["org/ui-team"], "conf": 0.8, "evidence": ["CODEOWNERS:path/ui/*"], "rationale": "..." }

// Prioritizer
{ "priority": 82, "factors": {"impact":0.9,"blast_radius":0.7,"user_pain":0.8,"freshness":0.6,"repro":0.7,"trust":0.8}, "rationale":"..." }


⸻

10) Phased Delivery & Prioritized Backlog

Phase 0 — Spike (Week 1–2)
	•	GitHub App scaffold + webhook receiver.
	•	Postgres + pgvector; embedding job.
	•	Minimal ANN retrieval; log-only suggestions.
	•	Success: pipeline runs end-to-end in staging.

Phase 1 — MLP (Minimum Lovable Product) (Week 3–6)
	•	P1: Triage comment with labels/assignee/priority + similar issues.
	•	P1: Confidence thresholds + “suggest vs auto-apply” switch per repo.
	•	P1: Admin toggles (per-label thresholds); audit log.
	•	P2: Simple duplicate “close as dupe” (manual confirm button).
	•	P2: Weekly analytics email.
	•	P3: Slack preview command.

Phase 2 — Quality & Scale (Week 7–10)
	•	P1: Dupe auto-close above high confidence; link canonical.
	•	P1: Routing map import from CODEOWNERS; team mapping UI.
	•	P1: A/B evaluation harness; offline labeled set; dashboard.
	•	P2: Project v2 field updates (priority/status).
	•	P2: Rate-limit batching via GraphQL.
	•	P3: Multi-repo, org-wide settings.

Phase 3 — Enterprise (Week 11–14)
	•	P1: SSO, audit exports, PII policy, data retention.
	•	P1: Fine-tuned label classifier per repo (optional adapter).
	•	P2: Human-in-the-loop UI (approve/override queue).
	•	P2: SLA alerts if triage queue backs up.
	•	P3: Slack/Teams rich actions.

Backlog (impact/effort)

Item	Impact	Effort
Triage comment w/ labels+assignee+priority	High	Low
Near-dupe detection (retrieval + LLM)	High	Med
Auto-apply w/ thresholds	High	Low
Auto-close duplicates	High	Med
Routing from CODEOWNERS	Med	Low
Analytics & eval harness	Med	Med
Slack preview/apply	Med	Med


⸻

11) Config & Policies
	•	Per-repo settings: thresholds, auto-apply toggles, labels excluded from auto.
	•	Privacy: minimize data retention; redact emails/tokens; configurable retention window (e.g., 90 days).
	•	Compliance: SOC2-friendly logging and access controls.

⸻

12) Error Handling & Edge Cases
	•	Huge issues (>100k chars): summarize chunked, skip attachments.
	•	Non-English issues: auto-detect language, translate for embedding, preserve original.
	•	Rate limits: queue + backoff; partial updates; idempotent operations.
	•	Private repos: respect scopes; never leak references across repos.
	•	Flapping edits: debounce (e.g., 10s window) before triage run.

⸻

13) Testing & Evaluation
	•	Golden set: sample 500 historical issues hand-labeled (dupe/not, labels, owner).
	•	Offline metrics: precision/recall for dupes; label accuracy; routing accuracy; calibration curves for confidence.
	•	Canary: suggest-only in 1–2 repos, track acceptance.
	•	Load: 100 RPS webhook burst; ensure <30s median triage.

⸻

14) DevOps
	•	CI: lint, typecheck, unit tests, contract tests for JSON schemas.
	•	CD: blue/green deploy; DB migrations w/ Prisma or TypeORM.
	•	Feature flags via LaunchDarkly/OpenFF.

⸻

15) Prompts (seed examples)

Dedup Agent (pairwise)

System: You compare a new issue to a candidate issue. If they describe the same underlying problem, return duplicate_of=true with short reason. Consider version, stack trace, steps.

User:
NEW:
Title: "Crash on startup v1.8.2 on macOS 14.5"
Body: "After updating to v1.8.2, app crashes at launch. Stack trace: ..."

CANDIDATE #1234:
Title: "App crashes on macOS Sonoma after 1.8.2"
Body: "Immediate crash with signal 11, trace ..."

Return JSON: {"duplicate": true, "confidence": 0.92, "rationale": "..."}

Classifier Agent

System: Propose labels (multi-label) and component. Use only existing labels list. Return confidences 0-1.

User:
Repo labels: ["bug","feature","docs","ui","cli","build"]
Issue text: "Clicking the avatar in header crashes UI. Repro: ..."

Prioritizer Agent

System: Score priority 0-100 using factors: impact, blast_radius, user_pain, freshness, repro, trust. Return JSON with factors and 1-sentence rationale.


⸻

16) Acceptance Criteria (v1)
	•	New issue → triage comment within ≤30s including: labels (≥2), assignee/team (≥1), priority score, top-3 similar issues with links.
	•	Confidence thresholds configurable; “auto-apply” works and logs decisions.
	•	Offline eval dashboard shows dupes F1 ≥0.8, label accuracy ≥0.85 on golden set.
	•	All actions reversible; overrides recorded in decision_log.

⸻

17) Open Questions
	•	Use Projects v2 fields vs labels for priority?
	•	Per-org vs per-repo model adapters?
	•	Slack vs GitHub UI for approval queue (Phase 2)?

⸻

Appendix: Minimal GitHub permissions (App)

Short list:
	•	Issues: Read & write
	•	Metadata: Read
	•	Pull requests: Read (for references)
	•	Contents: Read (for CODEOWNERS)
	•	Members/Teams: Read (for routing, if needed)
	•	Projects: Read & write (if used)

⸻
