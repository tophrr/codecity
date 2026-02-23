## 0. Building Spawn Animation ⚡ TOP PRIORITY

- [ ] 0.1 Add `targetHeight` and `currentHeight` refs to `Building.tsx` so each building tracks its animated vs. desired height
- [ ] 0.2 Use `useFrame` to lerp `currentHeight` toward `targetHeight` each frame using an ease-in-out factor (e.g. `dt * 6`)
- [ ] 0.3 On first mount (new building appearing), start `currentHeight` at `0` so it grows from the ground up
- [ ] 0.4 When `targetHeight` changes (file grows/shrinks across commits), lerp smoothly to the new value rather than snapping
- [ ] 0.5 Update `mesh.scale.y` and `mesh.position.y` each frame to keep the building anchored to the ground plane during animation

## 1. Dependencies & Setup

- [ ] 1.1 Install `@react-three/postprocessing` for bloom effect

## 2. Data Layer

- [ ] 2.1 Extend `buildCityAtCommit` to return the set of file paths changed in the current commit (not just cumulative state)
- [ ] 2.2 Add a `getCommitChangedPaths(commits, index)` helper that returns `Set<string>` for a given commit index

## 3. Height Scale

- [ ] 3.1 Replace linear height formula (`size * 0.1`) with logarithmic scale (`Math.log10(size + 1) * 3`) in `Building.tsx`

## 4. Recency Color Mapping

- [ ] 4.1 Compute a `[0..1]` recency score per building, where `1.0` = changed in most recent commit, decaying toward `0.0` for older files
- [ ] 4.2 Map recency score to a hot→cold color interpolation (red/orange → blue/grey) using Three.js `Color.lerpColors`
- [ ] 4.3 Remove existing file-extension color switch in `Building.tsx`

## 5. Commit Diff Highlighting

- [ ] 5.1 Pass `changedPaths: Set<string>` from `App.tsx` down through `Scene` → `City` → `District` → `Building`
- [ ] 5.2 In `Building.tsx`, apply a bright emissive color (e.g. `#ff6600`) when `changedPaths.has(node.path)`, and animate a brief pulse using `useFrame`

## 6. Building Selection Panel

- [ ] 6.1 Add `onSelect` click handler in `Building.tsx` that calls a callback with the node's data
- [ ] 6.2 Add `selectedBuilding` state in `App.tsx`
- [ ] 6.3 Create a `<BuildingInfoPanel>` component that renders file name, path, LoC, last modified, and total churn (additions + deletions)
- [ ] 6.4 Style the panel (slide-in panel on the right side of the screen)

## 7. Animated Play Mode

- [ ] 7.1 Add `isPlaying` and `playSpeed` state in `App.tsx`
- [ ] 7.2 Use `setInterval` / `useEffect` to advance `timeIndex` while playing
- [ ] 7.3 Add Play/Pause button and speed selector (0.5×, 1×, 2×) to the UI overlay

## 8. Atmospheric Fog

- [ ] 8.1 Add `<fog>` primitive to `Scene.tsx` with color matching the background (`#111`) and tuned near/far distances

## 9. Bloom Post-Processing

- [ ] 9.1 Wrap the `<Canvas>` content with `<EffectComposer>` and a `<Bloom>` effect from `@react-three/postprocessing`
- [ ] 9.2 Mark "hot" (recently changed) buildings with `layers` or a higher emissive intensity so bloom is selective

## 10. Visual Polish

- [ ] 10.1 Update `App.css` with panel and button styles matching the dark city aesthetic
- [ ] 10.2 Add hover tooltip in 3D space (use `@react-three/drei` `<Html>`) showing file name on pointer-over
