# Design: Project Initialization

## Directory Structure

We will follow a standard Vite + React project structure:

- `src/`: Source code
  - `components/`: Reusable UI and 3D components
  - `systems/`: Logic systems (e.g., data fetching, layout generation)
  - `types/`: TypeScript definitions
  - `utils/`: Helper functions
- `public/`: Static assets
- `tests/`: Test files

## Technology Choices

- **Build Tool:** Vite (Fast, modern, native ESM support)
- **Language:** TypeScript (Strict typing for robustness)
- **Frontend:** React (Component-based UI)
- **3D Engine:** Three.js + React Three Fiber (Declarative 3D scenes)
- **Styling:** CSS Modules or plain CSS (keeping it simple as per guidelines)
- **Linting:** ESLint + Prettier (Code quality and formatting)
