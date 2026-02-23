## Context

The current implementation renders buildings using linear LoC scaling and static file-extension colors. The project spec defines a richer visual language (recency heat + temporal diff highlighting) that is not yet implemented. Several features in this change affect multiple components, so a design doc is warranted to align technical decisions before implementation.

## Goals / Non-Goals

- **Goals:**
  - Implement the recency color model defined in `project.md`
  - Make each time-travel step visually informative (diff highlighting)
  - Add interactivity (building selection) so users can extract insight, not just look
  - Add play mode for hands-free history replay
  - Improve depth and atmosphere without impacting performance (fog, bloom)
  - Fix height distortion caused by large files (log scale)

- **Non-Goals:**
  - Custom GLSL shaders (post-MVP; use standard Three.js materials for now)
  - Instanced rendering optimization (tracked separately)
  - Multi-repo city view (tracked separately)

## Decisions

### D1: Recency Score Calculation

**Decision:** Score = `clamp((now - lastModified) / maxAge, 0, 1)` where `maxAge` is the span from the oldest to newest commit in the dataset. Score `0` = most recent = hot (red), score `1` = oldest = cold (blue).

**Why:** Relative scoring ensures the color range is always used in full regardless of dataset age. Avoids "everything looks hot" or "everything looks cold" on short-lived repos.

**Alternatives considered:**
- Absolute age threshold (e.g. 30 days = hot): Too dependent on repo age, breaks for archived repos being reviewed post-mortem.

### D2: Height Formula

**Decision:** `h = Math.log10(size + 1) * 3`, minimum clamped to `0.2` world units.

**Why:** Logarithmic scale compresses spikes (a 10,000-line file becomes 4×, not 100×, taller than a 100-line file) while still preserving meaningful relative height differences.

**Alternatives considered:**
- `sqrt(size) * 0.5`: Similar compression, but log10 is more intuitive — each "order of magnitude" is one unit step.
- Cap at max height: Loses information about large files entirely.

### D3: Diff Highlighting Implementation

**Decision:** Compute `changedPaths` at the `App` level (from `commits[timeIndex].files`) and pass it as a `Set<string>` prop down to `Building`. Apply an `emissiveIntensity` boost (`1.5`) and `emissive` color (`#ff6600`) on matched buildings.

**Why:** `App` already owns `timeIndex`; this avoids duplicating commit-lookup logic in the component tree. A Set provides O(1) lookup per building render.

**Alternatives considered:**
- `useFrame` pulse animation on changed buildings: Adds visual dynamism; included as a nice-to-have in `Building.useFrame` but not required for the feature.

### D4: Bloom Selectivity

**Decision:** Use `@react-three/postprocessing` with a `luminanceThreshold` tuned so only high-emissive buildings (changed files) trigger bloom, not all geometry.

**Why:** Scene-wide bloom on grey buildings would look muddy. Selective bloom via emissive channel is the standard R3F pattern using `layers`.

### D5: Component Prop Threading vs Context

**Decision:** Use React props (not Context) for `changedPaths` and `onSelect`.

**Why:** The component tree is shallow (App → Scene → City → District → Building). Context would add indirection without meaningful benefit at this depth.

## Risks / Trade-offs

| Risk | Mitigation |
|---|---|
| Bloom adds GPU overhead | Use a low `intensity` (0.3) and `luminanceThreshold` (0.7) to keep it subtle |
| Prop threading is verbose | Acceptable at current tree depth; refactor to Context if nesting grows |
| Log scale makes all buildings look similar | Minimum height (0.2) ensures tiny files are still visible |

## Open Questions

- Should play speed be configurable by the user at runtime, or just a preset list (0.5×, 1×, 2×)?
- Should the building info panel be persistent (stays open) or auto-close when clicking elsewhere?
