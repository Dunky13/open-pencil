# Validation

```text
Figma-authored archive
        |
        v
     new reader ------> direct renderer ------> compare Figma image
        |
        v
  editor action -> undo/redo -> export
                                 |
                    +------------+-------------+
                    |                          |
                    v                          v
                new reader                 Figma reopen
                    |                          |
             state assertions          state + actions + image
```

## Distinct contracts

| Check | Proves | Does not prove |
| --- | --- | --- |
| Encoded-field assertions | Requested records were emitted | Figma interprets them correctly |
| OpenPencil round trip | Reader and writer agree on tested behavior | Independent format correctness |
| Figma property comparison | Tested effective properties match | Actual pixels or untested metadata |
| Direct render comparison | New-reader graph renders similarly | Export/reopen fidelity |
| Figma reopen and interaction | External interpretation and tested editing work | All documents/features work |

**Required invariant:** Figma is the compatibility oracle. Repeated round-trip stability and
agreement with the old reader are insufficient.

## Comparison discipline

- Verify the active Figma file key and target before capture.
- Use world-space coordinates; group-relative conventions can differ between APIs.
- Capture complete trees, including hidden descendants. Report hidden geometry separately.
- Match bounds, scale, fonts, and color space before measuring pixels.
- Use native resolution or increased export scale; do not downsample away differences.
- Do not export/reimport through the old reader to assess the new interpreter's rendering.
- Separate font availability from exact binary identity.
- Compare edited output to the same edit in original Figma, not an unchanged original.
- After mutation, allow dependent state to settle before reading the result.
- Inspect images as well as numbers. Small aggregate differences can hide wrong icons.

Use temporary clones for destructive oracle edits and verify cleanup. Record stable fixture
provenance next to the fixture, not transient cloud-file IDs in architecture documents.

## Maintained property comparison

Run from the repository root, with the matching Figma document open:

```sh
bun tools/visual-oracles/src/operations/compare/interpreted-document.ts \
  --file tests/fixtures/gold-preview.fig --node 1:3461 \
  --figma-key NmoHzskYNiSKOaRX14bMdw --output /tmp/gold-oracle
```

This writes source/actual captures, differences, and grouped diagnostics. It checks selected
properties, not pixels. `--allow-partial-assignments` is diagnostic-only: skipped assignments
are recorded and cause a nonzero exit. It does not turn partial interpretation into success.

- [Comparison and capture implementation](../../../tools/visual-oracles/src/document/)
- [Command implementation](../../../tools/visual-oracles/src/operations/compare/interpreted-document.ts)
- [Direct instance rendering workflow](../../../tools/visual-oracles/INSTANCE-INTERPRETER.md)

## Gates and regression placement

Use package tests for interpretation/export contracts, engine tests for shared editing/session
behavior, and committed Playwright snapshots for pixel-affecting renderer changes. Update a
snapshot only with an explained change and rerun without snapshot updates. Isolate both the
application server and MCP endpoint; reusing another worktree's server invalidates attribution.

```sh
bun run check
bun test packages/fig/tests tests/engine/io/fig/session
```

The complete repository test requirements remain in [AGENTS.md](../../../AGENTS.md).

**Known limitation:** a single automated workflow for full edited/unedited Figma visual
round trips is not yet complete. Corpus acceptance must cover Gold, shadcn, Material 3, and
nuxtui, with strictness, performance, and page-loading equivalence tracked separately. Counts
and timings from individual runs belong in result artifacts or the integration PR.
