# 0045 — Optional Advisor review, executor-owned work

Owner correction, 2026-09-09: Advisor reviews difficult work using a stronger
connected model. It must not require a separate planning exchange before the
executor can handle a request, especially a greeting.

Inputs: original request and attachments, selected executor and reviewer models,
existing per-session enable switch. Outputs: native executor result and a separate
review with its limitations. No provider identity is hard-coded.

Acceptance:
- Submit original work first; never generate a mandatory planning turn.
- Exact social acknowledgements without attachments use zero review calls.
- Other work gets one evidence-based final review; native failures can be reviewed
  for repair. At most one repair and two review calls per submission.
- Reviewer failure preserves execution history, reports unreviewed status, and
  never replays completed work. Failed execution cannot be labelled approved.
- Bind review to the current turn, selected model and unchanged transcript.
- Stop prevents subsequent repair and retains ownership until native cancellation
  is confirmed. Other sessions remain independent.
- The native runtime owns execution deadlines; enabling Advisor does not impose
  an extra four-minute limit on complex work.

Scope and limits: this change reviews settled work or settled execution failure.
It does not introduce a mid-tool-loop hook, automatic model upgrades, unlimited
retry, dollar-budget estimates, or a guarantee that review proves correctness.
Tool evidence is a bounded excerpt; filenames do not prove file contents.
The existing native inference contract and model availability checks remain.
Legacy historical plan reviews can still be displayed.

Cost: bounded review calls and bounded evidence, separate reviewer inference,
unchanged executor request/prefix. Measure usage before claiming savings.
Rollback: retain the beta33 package; no core or user configuration migration.
