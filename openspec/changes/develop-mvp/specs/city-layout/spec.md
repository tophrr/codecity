# Spec Delta: City Layout

## ADDED Requirements

### Requirement: Treemap Layout Generation

The system SHALL generate a 2D Treemap layout representing the file hierarchy, where area corresponds to a metric.

#### Scenario: Generate Treemap Layout

Given a hierarchical file structure with metric data (LoC)
When the layout engine runs
Then it should generate a Treemap layout where area corresponds to base metric
And preserve the hierarchy (directories contain files)

### Requirement: Layout Stabilization

The layout generation algorithm SHALL minimize movement of unchanged elements when the underlying data updates.

#### Scenario: Layout Stability

Given a set of files that change over time
When the layout is re-calculated for a new time step
Then the relative positions of unchanged files should remain stable
