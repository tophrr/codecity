# Proposal: Develop Minimum Viable Product

### Overview

Develop the core "Temporal Code City" MVP, enabling users to:

1. Ingest Git commit history from local repositories.
2. Visualize code evolution as a 3D city (buildings = files, districts = folders).
3. Navigate through time using a scrobber.

### Motivation

To deliver a working prototype that demonstrates the value of visualizing software evolution, fulfilling the project's primary purpose.

### Capabilities

- **Data Ingestion:** Parse Git logs into a structured JSON format.
- **City Layout:** Generate a stable Treemap layout for the city.
- **Visualization:** Render the 3D city using React Three Fiber.
- **Interaction:** Basic camera controls and time navigation.
