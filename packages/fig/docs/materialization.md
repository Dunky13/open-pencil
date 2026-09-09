# Materialization

```text
source ownership + evaluated occurrences
                  |
       allocate canonical identities
                  |
       populate children in saved order
                  |
       link source correspondence by owner
                  |
       record explicit/bound overrides
                  |
       resolve resources and live edits
                  v
          editable SceneGraph
```

## Construction and correspondence

Canonical page/container/component identities are allocated before dependent instances are
populated. A component referenced from another page must not be duplicated when its own page
loads. Occurrence nodes are mapped by source identity, not names or sibling indexes.

```text
Nested Label's live node
  +-- owner: Inner instance -> original Label in Inner component
  +-- owner: Outer instance -> Label in Outer's expanded Inner instance

One node can need both correspondences for different editing operations.
```

Swapping an instance preserves its role in the enclosing component, including property
references, while changing its main component and descendant expansion. Correspondence into
removed descendants ends at the swap boundary.

Component-property definitions belong to components/sets. Instances retain assignments and
references, not copied definition lists.

## Editing responsibilities

SceneGraph owns format-neutral override storage and mutation/query helpers. Core's editor owns
undo transactions, layout scheduling, and render invalidation. Import code must not simulate
editing with test-only undo closures or replay repairs after construction.

Later-page loading applies supported live component-field edits only to newly created
occurrences. Explicit destination overrides remain protected. Structural component edits are
currently rejected by the [session](./document-sessions.md) guard rather than replayed from stale
source data.

## Saved geometry and text

**Required invariant:** valid saved text geometry describes the saved appearance. Available
family/style is not proof that reshaping uses the same font binary.

**Implemented:** plain solid text and supported solid-color runs prefer valid saved glyphs.
Character indices associate glyph clusters with style-run paint. Occurrence-derived text sizes
supersede inherited source caches. Text/shaping/layout edits invalidate affected caches unless
the same update supplies replacements; paint-only edits preserve geometry.

**Known limitations:** complex text fills, complete decoration behavior, actual ligature
coverage, and exact font-identity reporting remain incomplete. Saved appearance is not proof
that subsequent layout recomputation or editing is correct.

Retained FIG layout metadata preserves distinctions such as implicit-size Hug. Explicit edits
must take precedence over retained values during [export](./export.md). Raw/pre-scale dimensions
and effective node geometry must not be conflated.

```text
Mutation                   Characters       Saved glyph geometry
-------------------------  ---------------  --------------------
Move node                  unchanged        retain
Change solid fill color    unchanged        retain
Change text                changed          invalidate
Change font variation      unchanged        invalidate
Supply reshaped glyphs     changed or same  replace explicitly
```

This is a cache-validity example, not permission to retain geometry after untested
shaping-affecting changes. The invalidation tests define the implemented coverage.

## Implementation and tests

- [Document assembly](../src/document/materialize.ts)
- [Occurrence materializer](../src/instance-overrides/materialize-instance.ts)
- [Owner-scoped correspondence](../src/instance-overrides/source-children.ts)
- [Live component edits](../src/instance-overrides/live-component-edits.ts)
- [Component-property domain](../../scene-graph/src/components/properties.ts)
- [Text cache invalidation](../../scene-graph/src/text-picture.ts)
- [Full-document editing test](../tests/document/gold-edit.test.ts)
- [Occurrence conversion/isolation tests](../tests/document/occurrence-conversion.test.ts)
- [Saved-glyph visual test](../../../tests/e2e/canvas/saved-glyph-visual.spec.ts)
