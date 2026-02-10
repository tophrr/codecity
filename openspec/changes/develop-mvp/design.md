# Design: MVP Architecture

### Data Flow

Git Repo -> Parser -> JSON -> Layout Engine -> Renderer

### Components

- **Parser:** Node.js script using `simple-git` or similar to extract logs.
- **Layout Engine:** Computes positions and dimensions based on file structure and metrics (LoC).
- **Renderer:** R3F components (`City`, `District`, `Building`).
- **State Management:** React Context or Zustand to hold current time and city data.
