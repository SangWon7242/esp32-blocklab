# SDD ledger — plan: /Users/lucas/works/python_projects/esp32-blocklab/docs/superpowers/plans/2026-10-14-plan2a-registry-and-cleanup.md
Spec: docs/superpowers/specs/2026-10-13-plan2-sensors-lint-device-design.md (binding; base spec 2026-10-13-esp32-blocklab-design.md)
Branch: main (Ruling 1 of plan 1 carries over: user wants commits on GitHub as built)

## Pre-flight scan (2026-10-14)
| Pair / Task | Produces vs consumes | Finding |
|---|---|---|
| T1 ↔ T2 | T1 adds countCodeBlocks + load({keepScroll}); T2 restructures LabPage layout and adds BottomPanel | both touch LabPage.tsx sequentially; T2 must keep T1's badge/keepScroll — noted in T2 dispatch |
| T3 ↔ T4 | T3 registry (DEVICES, setupSpecs, find*ByBlock, isGeneratedImport); T4 parser consumes them | names consistent; T3 keeps parser hard-coded so tests pass in between |
| T3 ↔ T5-7 | T3 types: setup optional, alsoIn, extraToolbox, ActionPattern none/method objKinds/objName/call/lines/expr | patched into types.ts block; T5 table references them |
| T4 ↔ T5-7 | T4 matchSetupAt/matchCall/matchExpr/matchActionLines/parseSubExpr; device tables use lines/method/call/expr/none patterns | consistent; "pattern lines: []" allowed (skip) per T5 note |
| T3 internal | blocks.test.ts category-order expectation changes to 15 categories | explicitly allowed exception (Ruling 15) |
| Global | "no runtime Blockly in src/devices" vs toCodegen.ts importing Order from blockly/python | Ruling 16 |
| T6/T7 | helper bodies are matched textually by parser (isStandardBody) — must equal generator output modulo indentation | dispatch reminds implementer to derive STANDARD body from helper spec, not duplicate |
Ruling 15: `src/blocks/blocks.test.ts` category-order expectation is updated to the 15-category layout — the test encodes the toolbox layout contract that the spec changes — costs: none.
Ruling 16: `src/devices/toCodegen.ts` may import `Order` from `blockly/python` and types from blockly (it is the codegen-facing adapter); `types.ts`, `registry.ts`, `specs/*`, `subexpr.ts`, `imports.ts` stay Blockly-free so the parser can import them — costs: the "devices is Blockly-free" rule applies per-file, documented in the dispatch.

## Task log
Task 1: implemented by agent ad1c3c41e298c2262, commit 3c29871 (BASE fb76f46); 180 unit, 7 e2e. Deviations: scrollbar e2e uses ESP32 category; function-name validator wraps Blockly's rename validator and is skipped during load; default function name my_function; \| escape covers header.
Task 1: review clean (agent a87232df274d1a031). minors deferred: undo-rename to reserved name rejected; `\| x` single-line becomes above-comment; scrollbar e2e second half depends on 흐름 palette height; 520px def column spacing; no hint toast on rejected function name.
Task 1: complete (commits fb76f46..3c29871, review clean)
Task 2: BASE 3c29871
Task 2: implemented by agent a629906c94a41bb9d, commit 56d0863 (BASE 3c29871); 180 unit, 9 e2e. Deviations: ResizeObserver skips svgResize at 0x0; no BlocklyHandle.resize; 36px 작업판 header; icon-only device buttons below md.
Task 2: review (agent a791a77a1af5588e4) 1 Important (narrow first-load not collapsed) → fix round 1/5 commit 7c3ec25, re-review (agent a0e9ba1bd09db2d28) clean. minors deferred: rAF not cancelled on unmount; code header badge may clip with the new "블록" text button.
Task 2: complete (commits 3c29871..7c3ec25, review clean)
Task 3: BASE 7c3ec25
Task 3: implemented by agent a6aff1ab376b5dd9d, commit 78d7c1c (BASE 7c3ec25); 188 unit, 9 e2e. Deviations: isGeneratedImport drops only Pin/PWM/SoftI2C lines (ADC kept) to preserve C1 tests; DEVICES order [servo, ultrasonic, oled, pinOut, pwm, printer]; inputsInline only when ≥2 value inputs; objKinds ["pin","ultrasonic"] on pin write/read; scrollbar e2e uses 핀 category at 1400×520.
Ruling 17: In Task 4, `isGeneratedImport` treats every MACHINE_NAMES member (incl. ADC) as regenerated, and the two C1 tests that used ADC as the "unknown" name switch to a name the generator never emits (`UART`) — the behaviour they test (unknown imports are kept) is unchanged — costs: two test inputs edited.
Task 3: review clean (agent a35654b7f22c0350e). minors deferred: collectImports auto-imports ADC for any `ADC(` text; isGeneratedImport normalizes whitespace; extraToolbox var-field path untested until Task 5; STANDARD_* duplicates until Task 4; no test for registerFieldColour.
Task 3: complete (commits 7c3ec25..78d7c1c, review clean)
Task 4: BASE 78d7c1c
Task 4: implemented by agent a5debaa9211ae443a, commit 2cac184 (BASE 78d7c1c); 204 unit. Deviations: parseSubExpr in src/parser/subexpr.ts (cycle); matching in convertStatements loop; objKinds on lines/expr patterns; multi-line setup comments kept; setup lines must be consecutive; lone PWM w/o freq not registered. Note for T5-7: specs must not import Order from blockly/python; lines patterns beat method/call; lines:[] setups need objPart+objKinds.
Task 4: review clean (agent a14b2386f27fbec77). minors deferred: trailing comments on 2nd+ folded lines move above the block (could attach per setup line); ADC used only as attribute drops its import; survey vs conversion could disagree if an action `lines` pattern swallowed a setup's first line (no spec does); no guard test against runtime Blockly imports from specs (Task 5 adds one).
Task 4: complete (commits 78d7c1c..2cac184, review clean)
Task 5: BASE 2cac184
Task 5: implemented by agent ad7cb6d2ed81b37f5, commit 4e429ce (BASE 2cac184); 286 unit, 9 e2e. Deviations: led_pwm folds only when freq 1000 and var name starts with "led"; HeadlessColourField for node tests; fixture edits in devices-patterns/toolbox-roundtrip tests; toolbox order follows DEVICES priority (joystick first, 입력 핀/아날로그 before 핀).
Ruling 18: led_pwm's fold heuristic (freq 1000 + variable name starting with "led") is accepted — otherwise it can never round-trip to itself without breaking esp_pwm_setup tests — costs: a PWM named `led` at 1000 Hz is shown as the LED block (same code).
Task 5: review clean (agent a1ccbfa3981219d35). minors deferred: brightness regex greedy group (pathological nested int()); pin_in pattern unreachable; flow PINS text unvalidated; inputOnly unused by arg(); tilt/button expr patterns claim any pin-kind `x.value() == n`.
Ruling 19: add optional `toolboxOrder` to DeviceSpec with a stable per-category sort in deviceToolboxCategories (Task 6 does it) so display order no longer depends on match priority — costs: one more field to maintain.
Task 5: complete (commits 2cac184..4e429ce, review clean)
Task 6: BASE 4e429ce
Task 6: implemented by agent a1e763b6ac4718e2b, commit a34db6e (BASE 4e429ce); 342 unit, 9 e2e. Concerns: ntc name field vs fixed helper name (→ Ruling 20); toolbox-roundtrip fixture edit (esp_pin_write prerequisite uses entry name); PWM@440Hz+duty(0) reads back as beeper; user functions named forward/backward/stop would collide with motor helpers.
Ruling 20: `dev_ntc_setup` loses its name field and uses the fixed name `ntc` (like LM35) because the helper body references `ntc` — costs: one thermistor per program.
Task 6: review clean (agent ad11f0ab0a46cd625). minor: dev_servo_angle greedy `(.+)` can re-associate `1638 + offset + a * 6462 // 180` (semantic change) — carried into Task 7 as a guard (Ruling 21); lm35 wrong-name test missing; `\bdht\.` rule matches a variable named dht.
Ruling 21: single-line `lines` patterns that capture a sub-expression (servo angle, LED brightness) only fold when the captured group is a single operand — balanced parentheses and no top-level `+`/`-` — otherwise the statement stays code — costs: such statements become code_stmt (lossless).
Task 6: complete (commits 4e429ce..375cd43, review clean)
Task 7: BASE 375cd43
Task 7: implemented by agent a2399d61ad2b41447, commits d463992 (Ruling 21 guard + lm35 test), da16ea9 (group C + libs + README) (BASE 375cd43); 397 unit, 9 e2e; pushed; Pages run 38431717589 OK. Concerns: Ruling 21 only guards +/-; Keyestudio lib files have no license header except gfx.py (MIT) — flag to user; gfx.py unused; lcd text not folded when Cursor args contain commas outside brackets; non-folded servo angle comes back as esp_pwm_duty.
Ruling 22: Keep the Keyestudio MicroPython library files bundled under public/lib with attribution (Keyestudio distributes them freely with the kit docs; the class repo already tells students to download them) and flag the licensing question to the user in the morning report — costs: if Keyestudio objects, the files must be removed and fetched at runtime instead.
Task 7: review clean (agent ae103023fc7fcf01f). minors deferred: SEGCODE pattern ignores list contents; isSingleOperand allows other low-precedence operators (<<, |, comparisons, and/or); OLED actions fold only after the standard show helper folded (undocumented in types.ts).
Task 7: complete (commits 375cd43..da16ea9, review clean, pushed, deployed)
All plan 2A tasks complete. Final whole-branch review: fb76f46..da16ea9
Final review (agent ae92b0fedaa1d57e2): 1 Critical (SEGCODE pattern drops edited list), 4 Important (fixed names not reserved/helper rename mismatch; missing dev_pwm_freq + duty10 in PWM section; registry metadata for 2B lint; roundtrip test lacks fixpoint assertion), minors. One fix wave dispatched (final-fix-brief.md).
Ruling 23: Spec deviations accepted as-is: passive buzzer has no octave selector; no per-category colour accent; header text hides below 768px (spec said 1024) — costs: cosmetic.
Final fix wave (agent a061337dacb357fbf): commits f014721, 82919b1, bd57e36; 426 unit, 9 e2e; pushed; Pages run 38435165068 OK.
Final fix wave re-review (agent a22838669e4197b94): all items ADDRESSED; new N1 (factor() + helper mark parentheses) → fixed in 73a421a (429 unit, 9 e2e, pushed, Pages 38436132756 OK). Ruling 24: N1 fix accepted on the implementer's test evidence without a third review round (small, test-covered) — costs: unreviewed 1-line change.
Plan 2A complete. HEAD 73a421a.
