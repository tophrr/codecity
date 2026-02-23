# Change: Enhance Visualization with Functional Aesthetics

## Why

The current visualization renders a static grey city where buildings have no actionable meaning — color is tied to file extension (purely cosmetic) while the project spec defines color as a measure of recency/activity. Users cannot identify which files changed during a commit, select buildings for details, or experience the temporal dimension of the city beyond navigating the slider. The visualization fulfills the core layout promise but fails the "insight" promise.

## What Changes

- **Recency Color Mapping:** Replace static file-type colors with a hot→cold gradient (red/orange for recent changes → blue/grey for old files), matching the project's visual mapping spec.
- **Commit Diff Highlighting:** Buildings that changed in the currently-viewed commit are highlighted with a "pulse" emissive color, making each time-travel step informative.
- **Building Selection Panel:** Clicking a building opens a side panel showing file name, path, current LoC, last modified date, and total additions/deletions across history.
- **Logarithmic Height Scale:** Replace `size * 0.1` linear scale with `log10(size + 1) * 3` to prevent a few large files from dominating the skyline and make smaller files legible.
- **Animated Time Travel (Play Mode):** A Play/Pause button that auto-advances the time slider through commits at a configurable speed, enabling hands-free replay of the repo's history.
- **Atmospheric Fog:** Add Three.js fog to the scene so distant buildings fade naturally, creating depth and focus without obscuring nearby structure.
- **Bloom Post-Processing:** Use `@react-three/postprocessing` to add a subtle bloom effect — "hot" (recently changed) buildings glow, making activity visually distinct from stable code.

## Impact

- Affected specs: `visualization`, `interaction`
- Affected code:
  - `src/components/Building.tsx` — color logic, height scale, click handler, new glow material
  - `src/components/Scene.tsx` — fog, bloom post-processing, passes `changedPaths` to City/Building
  - `src/components/City.tsx` / `District.tsx` — prop threading for changed paths
  - `src/App.tsx` — play/pause state, selection state, selected-building panel UI
  - `src/utils/cityBuilder.ts` — expose changed paths per commit
  - `src/App.css` — panel and button styles
- New dependency: `@react-three/postprocessing` (for bloom)
