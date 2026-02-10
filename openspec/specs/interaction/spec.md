# Spec: Interaction

## Purpose

To enable user exploration of the visualized city through time and space.

## Requirements

### Requirement: Time Travel

The system SHALL allow users to navigate through the project's history using a time slider.

#### Scenario: Time Navigation

Given a timeline of commits
When the user moves the slider
Then the city should update to reflect the state of the code at that point in time

### Requirement: Camera Controls

The system SHALL provide standard 3D camera controls (orbit, zoom, pan).

#### Scenario: Camera Control

Given a 3D scene
When the user drags the mouse
Then the camera should orbit around the city center
And allow zooming in/out
