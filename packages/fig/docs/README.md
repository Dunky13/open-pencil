# FIG package architecture

These documents explain the `.fig` reader replacement and its editing/export contracts.
They are package implementation documentation, not a release-status log.

## Reading order

| Document | Question |
| --- | --- |
| [Architecture](./architecture.md) | Which package owns each stage? |
| [Source model](./source-model.md) | What are records, resources, and identities? |
| [Instance evaluation](./instance-evaluation.md) | How do bindings and overrides resolve? |
| [Materialization](./materialization.md) | How do occurrences become editable nodes? |
| [Document sessions](./document-sessions.md) | How do incremental loads and recovery work? |
| [Export](./export.md) | How are runtime identities and claims encoded? |
| [Validation](./validation.md) | What constitutes compatibility evidence? |

```text
archive -> source model -> instance evaluation -> materialization
                                                    |
                                  document sessions + editor actions
                                                    |
                                                  export
                                                    |
                                            Figma validation
```

## Status vocabulary

- **Required invariant:** a correctness constraint, whether or not all cases satisfy it yet.
- **Implemented:** behavior present in the linked modules and covered by the cited tests.
- **Known limitation:** a boundary not yet implemented or validated; not a supported fallback.

The replacement is under construction. Completion requires migrating every consumer and
**deleting the old reader and repair pipeline**. There will be one reader, not a permanent
legacy mode or alternative production interpretation path.

Keep temporary file keys, benchmark runs, experimental findings, and current blockers in
ignored `scratch/` notes or the integration PR. Fixture provenance belongs alongside fixtures.
The [public roadmap](../../docs/development/roadmap.md) owns product-level direction.
