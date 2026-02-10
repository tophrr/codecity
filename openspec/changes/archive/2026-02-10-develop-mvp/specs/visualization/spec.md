# Spec Delta: Visualization

## ADDED Requirements

### Requirement: Building Rendering

The system SHALL render files as 3D box "buildings" with height corresponding to lines of code.

#### Scenario: Render Buildings

Given layout data with positions and dimensions
When the scene is rendered
Then buildings should be displayed as 3D boxes
And height should correspond to lines of code

### Requirement: District Rendering

The system SHALL render directories as flat "districts" containing their children files/directories.

#### Scenario: Render Districts

Given layout data for directories
When the scene is rendered
Then districts should be displayed as flat baseplates containing their children
