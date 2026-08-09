Install ECC
Note

The guided commands below require ecc-universal 2.2.0 or newer. If npm still resolves 2.1.0, use the provider-native instructions below until the 2.2.0 package is published.

Pick one path only (per harness)
You can use ECC with Claude Code, Codex, and other harnesses at the same time. Choose one install method for each harness:

Recommended default: run the guided Claude plugin setup with npx ecc-universal setup
Recommended for multiple harnesses: run npx ecc-universal install --guided
Works: Claude Code plugin + Codex native plugin
Works: Claude Code plugin + the legacy Codex sync flow
Avoid: Claude Code plugin + full Claude manual install
Avoid: Codex sync + Codex marketplace plugin
Do not stack install methods. Installing ECC twice into the same harness can duplicate skills, commands, hooks, or configuration; installing it once into multiple harnesses does not.

If you already layered multiple installs and things look duplicated, skip straight to Reset / Uninstall ECC.

Install trouble? Open the short install or runtime problem form, or run ecc feedback. ECC never uploads diagnostics automatically.

Guided setup (recommended)
For Claude Code plugin setup, updates, scope changes, and hook-profile changes:

npx ecc-universal setup
The same published package works with modern package runners:

Package runner	Guided setup command
npm / npx	npx ecc-universal setup
pnpm	pnpm dlx ecc-universal setup
Yarn 2+	yarn dlx ecc-universal setup
Bun	bunx ecc-universal setup
Yarn Classic 1 does not provide yarn dlx; use npx, install the package globally, or upgrade Yarn for a temporary one-shot run.

The wizard inventories the official marketplace and every native Claude install scope before making changes, then installs, updates, or safely moves ecc@ecc to the scope you choose. Rerun the same command whenever you want to update ECC, change scope, or change its hook profile. This setup wizard currently configures the Claude Code plugin; use the multi-harness wizard below for Codex or Kimi Code.

To configure more than one coding agent in one reviewed flow, use the multi-harness wizard:

npx ecc-universal install --guided
It lets you select any combination of Claude Code, Codex, and Kimi Code, shows each install channel and destination, preflights every selection before the first write, and asks for one final confirmation.

Harness	Guided install behavior
Claude Code	Native ecc@ecc plugin with one user, project, or local scope and an ECC hook profile
Codex	Native Codex marketplace/plugin lifecycle; hook review and trust remain Codex-owned
Kimi Code	Managed project files under ./.kimi-code; ECC hooks, model/provider settings, and authentication are not configured
For automation, make every provider-specific choice explicit:

npx ecc-universal install --guided \
  --harness claude --harness codex --harness kimi \
  --claude-scope local --claude-hooks standard \
  --profile core --yes
Verify the native guided Codex path and managed Kimi path without writing first:

npx ecc-universal install --guided --harness codex --dry-run
npx ecc-universal install --profile core --target kimi --dry-run
ECC also ships advanced managed adapters for cursor, antigravity, gemini, opencode, codebuddy, joycode, qwen, zed, hermes, and openclaw. Those targets still use their documented ecc install --target ... paths until each adapter has passed the guided collision, update, repair, and uninstall lifecycle matrix. Neither wizard silently installs into every detected harness.

Claude Code
Use Claude Code's built-in marketplace commands only when you specifically want the native path or cannot run the package wizard:

/plugin marketplace add https://github.com/affaan-m/ECC
/plugin install ecc@ecc
That installs ECC's skills, agents, commands, and plugin-managed hooks. Claude Code owns these built-in commands, including their errors when a marketplace, plugin, or conflicting scope already exists. ECC cannot intercept that parser. If either command reports an existing install or scope conflict, run npx ecc-universal setup; the ECC-owned flow inspects the current state and chooses install, update, or verified scope migration instead of blindly adding a duplicate.

After ECC is installed, /ecc:configure-ecc is the namespaced in-Claude reconfiguration skill. It delegates to the same safe setup flow, but it is available only after the plugin is installed and cannot replace Claude Code's built-in /plugin command during a first install.

Claude Code plugins cannot distribute rules, so add only the rule packs you actually want:

git clone https://github.com/affaan-m/ECC.git
cd ECC
mkdir -p ~/.claude/rules/ecc
cp -R rules/common ~/.claude/rules/ecc/
cp -R rules/typescript ~/.claude/rules/ecc/  # replace with your stack
Start with rules/common plus one language or framework pack you actually use. If you install the plugin, do not run ./install.sh --profile full afterward.

Prefer settings.json? Add the marketplace declaratively
Naming + migration note (ecc@ecc, affaan-m/ECC, ecc-universal)
Codex App and CLI
Current Codex releases can install ECC as a native repo-marketplace plugin. The marketplace entry uses the repository root so Codex's cache receives the manifest together with all referenced skills, MCP configuration, hook runtime, scripts, and assets:

codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
codex plugin list --json
node scripts/codex/check-plugin-cache.js
Both add commands are idempotent. To refresh later, run codex plugin marketplace upgrade ecc followed by codex plugin add ecc@ecc. Codex stores one enabled plugin state in the active CODEX_HOME; it does not offer Claude's user, project, and local scopes. Its native hooks require an explicit trust decision and do not use Claude's four ECC hook profiles. Inside Codex, invoke $configure-ecc for the guided provider-aware flow.

The older scripts/sync-ecc-to-codex.sh path remains a separate compatibility option for users who intentionally want copied and merged configuration in ~/.codex; it is not required for the native plugin. Run Codex once first so ~/.codex/config.toml exists, then:

git clone https://github.com/affaan-m/ECC.git
cd ECC
npm install
bash scripts/sync-ecc-to-codex.sh
You can also open the ECC repository directly in Codex for a project-local setup. Codex reads the root AGENTS.md and the trusted project configuration in .codex/ without a global sync. Do not add the native marketplace plugin on top of the sync flow.

For repo navigation, surface ownership, and PR diff packet guidance, read the Codex ECC Navigation Map. See the .codex plugin notes for native lifecycle details.

Other agents and editors
Cursor, OpenCode, Gemini, Zed, Antigravity, Qwen, Hermes, OpenClaw, Kimi, CodeBuddy, JoyCode, Copilot
Advanced Install Options
The options stay here, directly under the main install paths, so you do not have to hunt through the README when the default setup is not the right fit.

Low-context install with no hook runtime
Choose only the components you need
Project-local rules instead of global rules
Fully manual Claude install
Multi-model commands require additional setup
Custom API endpoints, model gateways, and self-hosted models
Reset, repair, or uninstall
Start Using ECC
Start with the workflow you need, not the full catalog.

What you are doing	Start here
Building a feature	/ecc:plan "describe the feature", then tdd-workflow
Fixing a bug	Reproduce it with a failing test, then use tdd-workflow
Reviewing new code	/code-review for a fresh-context review
Repairing a build	/build-fix
Cleaning a codebase	/refactor-clean
Checking context pressure	/context-budget
Ending a long session	/save-session or /learn-eval
Resuming later	/resume-session
Auditing agent config	/security-scan or npx -y ecc-agentshield scan --path .
Plugin commands and manual commands
Which agent should I use?
Common workflows
What's New: ECC 2.1
Important

NEW IN ECC 2.1: Plan Canvas · Kimi harness · self-hosted compute on Itô GPUs. See the full release notes →

Plan Canvas: review plans by pointing, not retyping
Your agent writes a plan, then opens it in a loopback-only browser canvas. Click the part you mean, attach numbered annotations, chat from a side rail, and hit Approve plan or Request changes. The verdict maps straight onto /plan's CONFIRM gate. Mermaid diagrams render live, and edits to the plan file reload the page.

Plan Canvas demo: reviewing an ECC plan in the browser, scrolling diagrams, attaching an anchored annotation, chatting with the agent, and approving the plan

It's harness- and model-agnostic: a plain CLI (ecc-plan-canvas) speaking JSON, so any agent can drive it. Try it: ask your agent to /ecc:plan anything, then review from the page instead of the terminal.

Open the plan used in this demo →

Also in 2.1
Kimi Code install target (--target kimi): ECC installs natively into Moonshot AI's Kimi Code CLI
Self-host on GPUs: a verified path with Itô, ECC's preferred compute sponsor, including the opt-in ecc ito find RFQ bridge (details and disclosures above in the install options)
Moonshot AI (Kimi), Itô, and Atlas Cloud are now public sponsors
Hermes + OpenClaw install targets, a Codex navigation guide, consolidated PostToolUse hooks, and supply-chain hardening
Current development: Unified Memory Vault
ecc memory gives Claude, Codex, Hermes, OpenClaw, Kimi, and other harnesses one local, inspectable Markdown format for durable context and handoffs. The optional ecc-memory-mcp stdio server exposes the same bounded save/search/read/doctor surface without enabling itself by default. Full detail in Share context between harnesses below.

Previous releases
Release history in detail
Why Choose ECC?
Without a system	With ECC
Plans disappear into chat history	Plans become editable artifacts before implementation starts
"Please use TDD" is an instruction the model may forget	TDD becomes a gated RED -> GREEN -> REFACTOR workflow with evidence
The same context writes and reviews the code	A fresh-context reviewer looks for regressions and blind spots
Memory means saving an enormous transcript	Sessions are distilled into summaries, instincts, and reusable skills
Quality checks depend on reminders	Hooks can enforce deterministic checks outside the prompt
Agent configuration is trusted by default	AgentShield scans the harness itself as an attack surface
TDD: Test-Driven Development
/ecc:plan "Add usage-based billing alerts"
  -> confirm or edit the plan
  -> activate tdd-workflow
  -> capture RED evidence before implementation
  -> implement until GREEN
  -> review from fresh context
  -> fix findings with regression tests
  -> verify build, lint, types, and tests
A result is not just code. It's a trail of evidence: the plan, the failing test, the passing test, the review findings, and the final verification.

Skills keep the context focused
Rules, skills, agents, and hooks solve different problems. Keeping those jobs separate is how ECC adds capability without dumping the entire repository into every session.

Concept	What it does	Context behavior
Skills	Reusable workflows such as TDD, security review, or deep research	Loaded when the task needs them
Agents	Scoped workers with their own context and tool permissions	Isolate planning, implementation, and review
Rules	Durable project or language standards	Always loaded, so install them selectively
Hooks	Scripts triggered by harness events	Run outside the model context
Instincts	Patterns learned from real sessions with confidence scores	Recalled when relevant
Share context between harnesses
ECC's Memory Vault gives Claude, Codex, Hermes, OpenClaw, Kimi, and other harnesses one local, inspectable Markdown format for durable context and handoffs. Project and team memories live under .ecc/memory/; user memories live under ~/.ecc/memory/.

npm install -g ecc-universal
ecc memory init --scope project
ecc memory search "authentication migration" --target-harness codex
ecc memory doctor
Memory is unreviewed context, not executable policy. Verify important claims against authoritative sources and promote accepted knowledge into governed project documentation. The optional ecc-memory-mcp server exposes the same bounded save, search, read, and doctor surface without enabling itself by default.

Open the Unified Memory workflow →

Memory Vault in depth: scopes, handoffs, and trust boundaries
Guides
This repo is the raw code. The guides explain everything.

The Shorthand Guide to ECC
The Shorthand Guide
Setup, foundations, and day-one use. Read this first. (thread)	The Longform Guide to ECC
The Longform Guide
Context economics, memory, evals, and parallel agents. (thread)	The Security Guide to ECC
The Security Guide
Prompt injection, hooks, MCP, and AgentShield. (thread)
Topic	What You'll Learn
Token Optimization	Model selection, system prompt slimming, background processes
Memory Persistence	Hooks that save/load context across sessions automatically
Continuous Learning	Auto-extract patterns from sessions into reusable skills
Verification Loops	Checkpoint vs continuous evals, grader types, pass@k metrics
Parallelization	Git worktrees, cascade method, when to scale instances
Subagent Orchestration	The context problem, iterative retrieval pattern
Commands Quick Reference | Manual Adaptation Guide

What's Inside
ECC/
|-- agents/           # 67 specialized subagents for delegation
|-- skills/           # 282 reusable workflows loaded on demand
|-- commands/         # 94 maintained slash-command shims
|-- rules/            # opt-in common and language standards
|-- hooks/            # runtime automation and enforcement
|-- scripts/          # install, repair, sync, orchestration, and checks
|-- .claude-plugin/   # Claude Code marketplace manifest
|-- .codex/           # Codex reference configuration and agent roles
|-- .opencode/        # OpenCode plugin, commands, and instructions
|-- .cursor/          # Cursor rules and hook adapter
|-- docs/             # public setup, architecture, and operating guides
The root is the source of truth. Platform adapters package or map these same workflows instead of maintaining separate copies.

Annotated component catalog
Dashboard GUI
Ecosystem Tools
Skill Creator: generate skills from your git history
AgentShield: security auditor for agent configs
Continuous Learning v2: instincts
Key Concepts
Agents, skills, hooks, and rules explained
Cross-Platform Support
ECC's core Node.js CLI and managed installers run on Windows, macOS, and Linux, but optional capabilities are not at full parity. Some continuous-learning, GAN, and orchestration paths still require Bash or Python; harnesses also expose different hook, agent, and skill APIs.

Platform	Status	Current limitation
Linux	Supported core	Optional features may require Bash, Python, or provider-specific tools.
macOS	Supported core	The standalone GAN shell path is not compatible with the system Bash 3.2 and currently has a score-parsing defect (#2674).
Windows + WSL	Supported core	WSL follows the Linux paths; Windows host integrations still vary by harness.
Windows native	Supported with limitations	Continuous-learning v2's observer daemon and memory-vault writes have open native-Windows defects (#2489, #2626). Shell-backed optional features require Git Bash/WSL or are unavailable.
Treat stable, beta, experimental, and instruction-only below as capability statements, not marketing tiers.

Package manager detection
Hook runtime controls (env vars)
Agent data home (multi-harness isolation)
Platform Support
Harness	Status	Recommended distribution	Important limitation
Claude Code	Stable primary	Plugin or selective installer	The plugin advertises the installed catalog to the model; use a selective/manual profile when context footprint matters. Optional shell-backed skills are not portable to every OS.
Codex	Supported sync; marketplace experimental	Repo config or sync-ecc-to-codex.sh	No ECC hook runtime. The marketplace package can omit shared repository content from Codex's cache; use sync for the reliable path.
Cursor	Beta project adapter	Selective installer into .cursor/	Agent discovery varies by Cursor build, and ECC's installer paths do not yet expose identical hook sets (#2419).
OpenCode	Beta built plugin	Build plugin, then selective installer	ECC ships a subset of the catalog and the reference config pins Anthropic models; select models available to your provider (#2617).
GitHub Copilot	Instruction-only	Checked-in instructions and prompt files	No ECC hooks, runtime agents, delegation, or native skill discovery.
Gemini, Zed, Antigravity, Qwen, Hermes, OpenClaw, Kimi, CodeBuddy, JoyCode	Experimental/minimal adapters	Harness-specific selective target	File placement and instruction portability are tested; full Claude feature parity is not claimed.
Cross-tool capability map
Capability	Claude Code	Codex	Cursor	OpenCode	GitHub Copilot
Instructions	Native	Native AGENTS.md	Project rules	Plugin instructions	Native instruction file
Skills	Native installed set	Native synced set	Build-dependent/project set	Built subset	Prompt/instruction references only
Agents/delegation	Native agents	Codex multi-agent roles	Build-dependent project agents	Plugin agents	Not supported
ECC hooks	Native plugin hooks	Not supported	Cursor hook adapter; install-path differences remain	Plugin events	Not supported
MCP configuration	Available, explicit activation	TOML merge through sync	Explicit project/user config	Provider/plugin config	Not supplied by ECC
Parity with Claude Code	Primary reference	Partial	Partial	Partial	Not a parity target
Key architectural decisions:

AGENTS.md at root is the universal cross-tool file (read by Claude Code, Cursor, Codex, and OpenCode; GitHub Copilot uses .github/copilot-instructions.md instead)
DRY adapter pattern lets Cursor reuse Claude Code's hook scripts without duplication
Skills format (SKILL.md with YAML frontmatter) works across Claude Code, Codex, and OpenCode
Codex's lack of hooks is compensated by AGENTS.md, optional model_instructions_file overrides, and sandbox permissions
Cursor IDE support in depth
Codex macOS app + CLI support in depth
Zed support
OpenCode support in depth
GitHub Copilot support in depth
What changed in v2.0.0
Token Optimization
Agent usage can be expensive if you don't manage token consumption. These settings significantly reduce costs without sacrificing quality. Full guide: docs/token-optimization.md.

Recommended settings
Daily workflow commands
Strategic compaction
Context window management
Requirements
Claude Code CLI version + hooks auto-loading behavior
Security
Install ECC only from official sources:

GitHub repository: https://github.com/affaan-m/ECC
Claude Code plugin: ecc@ecc
npm packages: ecc-universal and ecc-agentshield
GitHub App: https://github.com/apps/ecc-tools
Website: https://ecc.tools
Scan a project with AgentShield:

npx -y ecc-agentshield scan --path .
Report a vulnerability. Use the private process in SECURITY.md (GitHub private vulnerability reporting). Please do not open public issues for security reports.
Built-in guardrails. GateGuard gates destructive shell commands (including rm, force/path git checkout, and destructive find -exec) before they run; the supply-chain IOC scanner runs in CI; and AgentShield audits your own agent, hook, MCP, permission, and secret surfaces (/security-scan).
Hooks, MCP servers, and context controls
Security references:

Security policy
Security guide
MCP connector policy
Supply-chain incident response
Troubleshooting
ECC appears twice or hooks fire twice
My hooks aren't working / "Duplicate hooks file" errors
Codex marketplace installs but skills do not load
My context window is shrinking
Can I use only some components (e.g., just agents)?
Does this work with Cursor / OpenCode / Codex / Antigravity / GitHub Copilot?
My platform is not listed
Running Tests
The plugin includes a comprehensive test suite:

# Run all tests
node tests/run-all.js

# Run individual test files
node tests/lib/utils.test.js
node tests/lib/package-manager.test.js
node tests/hooks/hooks.test.js
Background
I've been using Claude Code since the experimental rollout. Won the Anthropic x Forum Ventures hackathon in Sep 2025 with @DRodriguezFX, built zenith.chat entirely with agentic workflows.

These configs are battle-tested across multiple production applications.

Community and Project
Sponsors and ECC Pro
Contributing
Links
Shorthand Guide (Start Here): The Shorthand Guide to ECC
Longform Guide (Advanced): The Longform Guide to ECC
Security Guide: Security Guide | Thread
Follow: @affaan
License
MIT. Use it freely, adapt it to your workflow, and contribute back when you can.

Star this repo if it helps. Read the guides. Build something great.