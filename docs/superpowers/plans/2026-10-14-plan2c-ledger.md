# SDD ledger — plan: /Users/lucas/works/python_projects/esp32-blocklab/docs/superpowers/plans/2026-10-14-plan2c-device.md
Spec: base spec §7 + plan-2 spec §4. Branch: main.
## Pre-flight scan (03:15)
| Pair | Finding |
|---|---|
| T1 ↔ T2 | Device/RunResult/OutputEvent types consumed by useDevice; consistent |
| T2 ↔ plan 2B | ConsoleEntry needs a `source: "lint"|"device"` + kind for device rows (final-review recommendation) — T2 adds it without breaking lint entries |
| T2 | code mode must flush pendingCodeRef before run; traceback line → reveal(blockAtLine(view,line), line) |
| T3 | real board attached (/dev/cu.usbserial-110) but Web Serial port chooser needs a human click; controller cannot automate → T3 may stay pending |
## Task log
Task 1: implemented by agent a1fc0d266e6420912, commit 7f1c629 (BASE 5209376); 615 unit. Deviations: RunResult.stopped; tracebacks only via RunResult.error; local Serial type decls; cancelled/disconnected wording; last <stdin>/main.py frame; stop aborts upload.
Task 1: review (agent a1c885bc842aff27f) 2 Important (overlapping writes; DTR/RTS) + minors → fix 8c611e1 (620 unit). Ruling 28: the fix is verified in the Task 2 review instead of a separate scoped re-review (time) — costs: none if the reviewer covers it.
Task 1: complete (commits 5209376..8c611e1)
Task 2: BASE 8c611e1
Task 2: implemented by agent ab2ce6ce5ef48f996, commit 7951648 (BASE 8c611e1); 632 unit, 21 e2e; pushed; Pages 38448683521 OK; live fake-device check passed. Deviations: useDevice options object; saveToBoard.ts pure; run/save opens console tab.
Task 2: review (agent a7656f702be1497d5, also whole-plan) — Task 1 fix items all verified; 2 Important (CRLF split; per-chunk re-render) + minors → fix ab36acb (636 unit, 23 e2e, pushed, Pages 38450291726 OK, live fake-device check passed). Ruling 29: fix accepted on test evidence (no further review round tonight) — costs: unreviewed small diff.
Task 2: complete (commits 8c611e1..ab36acb)
Task 3 (real board): PENDING — needs a human click on Chrome's port chooser; checklist (20 items) in docs/reports/2026-10-14-overnight-report.md §5.
Plan 2C: complete except Task 3. HEAD ab36acb.
