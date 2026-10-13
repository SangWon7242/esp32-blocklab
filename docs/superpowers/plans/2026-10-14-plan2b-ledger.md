# SDD ledger — plan: /Users/lucas/works/python_projects/esp32-blocklab/docs/superpowers/plans/2026-10-14-plan2b-lint-console.md
Spec: docs/superpowers/specs/2026-10-13-plan2-sensors-lint-device-design.md §3 (binding)
Branch: main (plan-1 Ruling 1 carries over)

## Pre-flight scan (2026-10-14 02:20)
| Pair / Task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T2 | LineMap {blockToLines, lineToBlock} (1-based) vs lint(json, map) | consistent |
| T1 ↔ T3 | BlocklyHandle.getCodeWithMap, onChange(json, code, map), EditorState.map vs useLint/LabPage | consistent |
| T2 ↔ T3 | Issue {id, level, blockId?, line?, ko, en}, formatConsole → ConsoleEntry, alignLines | consistent |
| T1 internal | STATEMENT_PREFIX is prepended before scrub_ → scrub_ must put trailing comments on the 2nd line when code starts with a mark | stated in Task 1 |
| T1 internal | setup blocks return "" so their marks are bare lines; def blocks return null (no prefix) → ledger via addSetup/provideHelper/defGenerator mark | stated |
| T3 | e2e empty-input scenario uses "setup removed in code mode" instead of emptying a shadow | stated |
| Global | lint must be Blockly-free; labels.ts cannot read Blockly.Msg → own table for non-device blocks | stated |
Ruling 25: comment lines above a statement map to that statement's block (Task 1 Step 1 choice) — costs: none.

## Task log
Task 1: implemented by agent aa6134c1c3ac1e977, commit bd6e3a9 (BASE f68c511); 462 unit, 9 e2e. Deviations: marks converted to per-line tags at finish start; blockToCode/addLoopTrap/workspaceToCode overrides; hoistImports clean param; blocksChanged.map optional.
Task 1: review clean (agent a4da17f0cdf9fd24c). minors deferred: sentinel chars U+E000–E003 in user text would truncate lines (strip applied unconditionally); O(n²) chain split per change; blocksChanged.map optional; built-in provideFunction_ helpers unmapped.
Task 1: complete (commits f68c511..bd6e3a9, review clean)
Task 2: BASE bd6e3a9
Task 2: implemented by agent a74b48127163e7d8c, commit 3a4b6f8 (BASE bd6e3a9); 538 unit. Deviations: value-block issues fall back to the holding statement's line; variables matched by name; empty-body whileUntil not warned; calls to waiting functions count as waiting; code_expr also info.
Ruling 26: the orphan message ("실행되지 않아요") stands — the live workspace runs disableOrphans, so orphan blocks are disabled and emit no code; headless generation of a live-saved JSON honours `disabledReasons` — costs: a hand-built JSON without disabled flags would still emit orphan code (tests only).
Task 2: review clean (agent a2fedd86e1868089d). minors deferred: alignLines greedy cursor jump with hoisted setup lines + duplicates; setupPins treats non-IN as output; console entries carry `File "main.py", line N` prefix.
Task 2: complete (commits bd6e3a9..3a4b6f8, review clean)
Task 3: BASE 3a4b6f8
Task 3: implemented by agent a5fb9541b299ca590, commit b1aec77 (BASE 3a4b6f8); 545 unit, 13 e2e; pushed; Pages 38441067758 OK. Deviations: e2e scenario deletes the setup block; useLint reads the live workspace; syntax error hides other problems; empty workspace no 'no-start'; info issues get no block icon; one e2e expectation text changed (문제가 없어요).
Note: board /dev/cu.usbserial-110 attached at 02:50; pyserial open fails with EINVAL (driver/python quirk) — real-board check must go through Chrome Web Serial (needs a human click on the port chooser).
Task 3: review (agent afda67d0cc1195786) Approved with 1 Important follow-up (code-mode focus steal) → fixed in a5a3e9b (+gutter focus fix), 545 unit, 14 e2e, pushed, Pages 38442076486 OK. Ruling 27: the fix is verified in the whole-branch final review instead of a separate scoped re-review (time) — costs: none if the final review covers it.
Task 3: complete (commits 3a4b6f8..a5a3e9b)
All plan 2B tasks complete. Final whole-branch review: f68c511..a5a3e9b
Final review (agent a8e70a1755a9ab473): 0 Critical, 2 Important (issue line = comment line above; no visible block mark when focus is not moved), minors (noStart line 1; orphan blocks counted in other rules; setIssues id-diff vs recreate; fragile e2e). a5a3e9b approved. One fix wave dispatched.
Ruling 25 revised: comment lines still map to the block in lineToBlock (gutter/traceback), but the issue line is the block's first non-comment line — costs: none.
Final fix wave (agent a3082e846be6e5b97): commits 6305320, 5209376; 552 unit, 16 e2e; pushed; Pages 38444806674 OK. M5 e2e replaced by diffLintMarks unit tests.
Fix wave re-review (agent a9b0dbd2db66a369d): all ADDRESSED; two unverified items carried into plan 2C Task 2 — (1) `.lint-focus` stroke may lose to Blockly's selected-block rule (add computed-style assertion, raise specificity if needed); (2) confirm pinConflict reads realBlocks (orphan exclusion).
Plan 2B complete. HEAD 5209376.
