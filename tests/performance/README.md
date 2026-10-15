# V1.8.6.0.1 targeted profiling

Run from the patch worktree after installing its unchanged dependencies. Do not run the complete test suite.

```
node tests/performance/physical-harness.mjs build /path/to/pristine-c8f791c /tmp/physical-before.mjs
node tests/performance/physical-harness.mjs build "$PWD" /tmp/physical-after.mjs
node tests/performance/run-patch-benchmark.mjs
node tests/performance/extra-patch-cases.mjs
node tests/performance/audit-patch.mjs
node --expose-gc tests/performance/query-memory.mjs
node tests/performance/summarize-patch.mjs
node --expose-gc tests/performance/final-query-benchmark.mjs
```

The matrix runner skips existing output files: archive the existing output directory before deliberately remeasuring. It restores the exact full primary fixture from its gzip archive; input JSON parsing is benchmark fixture setup, not ShipOrder generation time. Cold runs use fresh Node processes. Warm runs generate an unrelated 100m Patrol with an explicit generous target before the target cache miss; this warmup is excluded from generation time but included in process wall time. `warm` also measures a same-input hit; the first warm sample additionally measures a changed seed.

An initial warmup without an explicit target was legitimately rejected by the original generator; see `before/warmup-failed.txt`. That failed experiment is excluded from successful timing aggregates. The unrelated warmup target was then made explicit on both versions. Target ship inputs were not changed.

For function counters build with trailing `profile` and run with `PROFILE=1`; `CPU_PROFILE=/tmp/name.cpuprofile` also captures V8 samples. These profiles are separate from the plain timing matrix. `DIAGNOSTICS=1` enables new runtime-only coarse diagnostics. Function counters include recursive/nested calls and are not additive exclusive times.

Browser scripts expect pristine and patch Vite servers on 5178/5177, and patch Production preview on 4207. Run `browser-patch-benchmark.mjs`, `tests/physical-patch-visual.mjs` and `tests/physical-patch-ui.mjs` separately from Node timing runs. Visual comparisons use original and patch renderers with identical camera poses, not image resizing or approximate pixel thresholds.
