# Frontend Setup

## ADDED Requirements

### Requirement: Core Frontend Dependencies

The project SHALL handle core frontend dependencies like React.

#### Scenario: Checking React dependencies

- **Given** `package.json`
- **Then** "react" should be in "dependencies"
- **And** "react-dom" should be in "dependencies"

### Requirement: 3D Graphics Libraries

The project SHALL include 3D graphics libraries including Three.js.

#### Scenario: Checking Three.js dependencies

- **Given** `package.json`
- **Then** "three" should be in "dependencies"
- **And** "@react-three/fiber" should be in "dependencies"
- **And** "@react-three/drei" should be in "dependencies"
