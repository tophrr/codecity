## ADDED Requirements

### Requirement: Building Spawn and Resize Animation

The system SHALL animate buildings growing from the ground up when they first appear, and smoothly interpolate height changes when their LoC changes across commits.

#### Scenario: New Building Appears

Given the user advances to a commit where a new file is introduced
When the building is first added to the scene
Then it SHALL start with a height of `0` and grow to its target height using an ease-in-out lerp
And the base of the building SHALL remain anchored to the ground plane throughout the animation

#### Scenario: Building Height Changes

Given the user advances to a commit where an existing file's LoC changed
When the new target height differs from the current rendered height
Then the building SHALL smoothly lerp to the new height using an ease-in-out curve
And SHALL NOT snap instantaneously to the new size

#### Scenario: Building Disappears

Given the user advances to a commit where a file is deleted
When the building is removed
Then it SHALL shrink back to height `0` before being unmounted from the scene

## MODIFIED Requirements

### Requirement: Building Rendering

The system SHALL render files as 3D box buildings with:
- Height proportional to Lines of Code using a **logarithmic scale** (`log10(LoC + 1) * 3`), with a minimum height of `0.2` world units.
- Color determined by **recency score**: a hot→cold gradient (red/orange for recently modified files, blue/grey for older files), computed relative to the visible commit range.

#### Scenario: Render Buildings with Recency Color

Given layout data and the timestamp of each file's last modification
When the scene is rendered
Then building **height** should correspond to LoC using a log scale
And building **color** should interpolate from hot (red/orange, recently modified) to cold (blue/grey, long unchanged)
And no file-extension-based coloring should be applied

## ADDED Requirements

### Requirement: Commit Diff Highlighting

The system SHALL visually highlight buildings that changed in the currently-viewed commit.

#### Scenario: Highlight Changed Files

Given the user is viewing commit N
When the scene renders
Then buildings whose file path appears in commit N's change list SHALL render with a bright emissive highlight color (orange `#ff6600`) at elevated emissive intensity
And buildings NOT in the change list shall render with their standard recency color

### Requirement: Building Selection Panel

The system SHALL allow users to click a building to view detailed file metadata.

#### Scenario: Select a Building

Given a rendered city
When the user clicks on a building
Then a side panel SHALL appear showing:
  - File name and full path
  - Current Lines of Code (LoC)
  - Date of last modification
  - Total cumulative additions and deletions across all commits

#### Scenario: Dismiss Selection

Given an open building info panel
When the user clicks on empty space or the close button
Then the panel SHALL close

### Requirement: Hover Tooltip

The system SHALL display the file name in a 3D HTML tooltip when the user hovers over a building.

#### Scenario: Hover Building

Given a rendered city
When the user moves the pointer over a building
Then a tooltip SHALL appear at the building showing the short file name

### Requirement: Atmospheric Fog

The system SHALL render fog in the 3D scene to create visual depth.

#### Scenario: Fog at Distance

Given a city of any size
When the scene is displayed
Then buildings far from the camera SHALL fade toward the background color
And nearby buildings SHALL remain fully visible

### Requirement: Bloom Post-Processing

The system SHALL apply a bloom (glow) effect to buildings with high emissive intensity.

#### Scenario: Bloom on Hot Buildings

Given post-processing is enabled
When a building is in a "highlighted" or "hot" (recently changed) state with high emissive intensity
Then a soft glow SHALL radiate from that building
And neutral/cold buildings SHALL NOT exhibit bloom
