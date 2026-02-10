# Project Context

## Purpose

**Temporal Code City** aims to visualize the evolution of microservices architecture using Git history. It leverages the "Software City" metaphor where:

- **Districts** represent Services (Microservices).
- **Buildings** represent Files or Classes.

The goal is to provide a temporal navigation system (post-mortem analysis) to visualize structural changes, code health, and team dynamics over time, addressing the challenge of understanding large-scale, multi-repository systems.

## Tech Stack

- **Frontend Framework:** React, TypeScript
- **3D Graphics:** Three.js, React Three Fiber (R3F)
- **Shader Language:** GLSL (for custom visual effects and performant rendering)
- **Platform:** WebGL (Browser-based)

## Project Conventions

### Code Style

- **Strict Typing:** TypeScript is used for all frontend logic.
- **Component-Based:** React components for UI and 3D scene management.
- **Custom Shaders:** Use GLSL for high-performance visual effects where standard materials are insufficient.

### Architecture Patterns

- **Graphics Pipeline:**
    1. **Data Parsing:** Extracting and aggregating Git commit logs from multiple repositories.
    2. **Layout Generation:** Procedural generation of city layouts (Treemap or Force-Directed) that remain stable over time (Layout Stability).
    3. **Rendering:** Efficient rendering of the 3D scene.
- **Rendering Optimization:**
  - **Instanced Rendering:** To handle thousands of building objects in a single draw call.
  - **Delta Updates:** Only updating properties of objects that change, rather than re-rendering the entire scene from scratch.

### Testing Strategy

- **Performance Benchmarking:**
  - **FPS (Frames Per Second):** Target >30 FPS on mid-range hardware.
  - **Draw Calls:** Minimizing draw calls via instancing.
  - **Memory Usage:** Monitoring memory footprint for large datasets.
- **Visual Validation:** Validating layout stability and absence of visual glitches (z-fighting).
- **Scalability Check:** Verifying performance with 10,000+ objects.

### Git Workflow

- Standard branching strategy (Feature branches -> Main/Master).
- Pull Request reviews for code quality assurance.

## Domain Context

- **Input Data:**
  - Source: Git Commit History (Multi-repo).
  - Format: JSON containing hash, author, timestamp, file_changed, insertions, deletions.
- **Visual Mapping Rules:**
  - **Height:** Corresponds to Lines of Code (LoC) - Taller buildings = larger files.
  - **Color:** Corresponds to Recency/Activity - "Hot" colors (red/orange) for recent changes, cooling down to "cold" colors (blue/grey) over time.
  - **Topology:** Treemap or Force-Directed graphs to organize districts and buildings.

## Important Constraints

- **Hardware Abstraction:** Must run smoothly on standard laptops with integrated or mid-range discrete GPUs.
- **Performance:** Rendering thousands of buildings without significant lag.
- **Data Integrity:** Accurate representation of Git history without data loss during aggregation.

## External Dependencies

- **Git Repositories:** The system relies on access to Git repositories (local or remote clones) to extract history.
- **Analysis Targets:** Open Source Microservices projects (e.g., Google Online Boutique) are used as standard datasets for validation.
