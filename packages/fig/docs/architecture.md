# Architecture

```mermaid
flowchart TD
  Kiwi[Kiwi: schema, codec, container] --> Archive[FIG archive and source index]
  Archive --> Dependencies[Dependency closure]
  Dependencies --> Evaluation[Occurrence evaluation]
  Evaluation --> Graph[SceneGraph materialization]
  Graph --> Core[Core: editor, undo, layout, fonts]
  Core --> Consumers[App, CLI, MCP, automation]
```

This shows responsibility flow, not a dependency graph of package imports.

## Ownership

| Domain | Owner |
| --- | --- |
| Kiwi schema/runtime and protocol containers | `@open-pencil/kiwi` |
| FIG archives, record interpretation, resource association, format conversion | `@open-pencil/fig` |
| Format-neutral graph, component-property mutations, override storage | `@open-pencil/scene-graph` |
| Editor actions, undo, render invalidation, layout scheduling, runtime fonts | `@open-pencil/core` |
| Worker lifecycle and format-neutral document I/O | Core |

**Required invariant:** adapters converge on the same document semantics. Neither Vue nor
an automation adapter implements an independent override resolver.

## Reader entry points

The package exposes record-based assembly, archive-owned assembly, and incremental sessions.
They share evaluation/materialization rather than invoking the superseded importer.
See [document sessions](./document-sessions.md) for ownership and lifecycle details.

- [Archive parsing and assembly](../src/archive.ts)
- [Document reader](../src/document/read.ts)
- [Document materialization](../src/document/materialize.ts)
- [Public exports](../src/index.ts)

## Replacement boundary

The finished system has one reader and no post-import repair replay. Reusing independent
codec, font, geometry, and resource utilities is appropriate; retaining an old interpretation
algorithm behind renamed wrappers is not.

**Known limitation:** the session worker uses the replacement backend, but other parse paths
and old-reader removal are not yet complete. The cutover audit must cover synchronous import,
worker import, later-page loading, export of unloaded pages, and every app/CLI/MCP caller.
Obsolete population, path-resolution, patch-replay, and sync-repair implementations and their
forwarding exports must be deleted, not kept as fallback behavior.

Relevant boundaries:

- [Session worker](../../core/src/kiwi/fig/session/worker.ts)
- [Format-neutral FIG read orchestration](../../core/src/io/formats/fig/read.ts)
- [Page controller](../../core/src/editor/pages.ts)

Compatibility is judged against Figma, not output agreement with the implementation being
removed. See [validation](./validation.md).
