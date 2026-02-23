## ADDED Requirements

### Requirement: Animated Play Mode

The system SHALL provide a Play/Pause control that automatically advances the time slider through commits.

#### Scenario: Start Play Mode

Given the user presses the Play button
When play mode is active
Then the time slider SHALL advance automatically at the configured speed
And the city SHALL update with each new commit
And the button label SHALL change to "Pause"

#### Scenario: Pause Play Mode

Given play mode is active
When the user presses the Pause button
Then the slider SHALL stop advancing
And the city SHALL remain at the current commit

#### Scenario: Play Reaches End

Given play mode is active
When the slider reaches the last commit
Then play SHALL automatically stop
And the Play button SHALL reset to its default state

### Requirement: Play Speed Control

The system SHALL allow users to select the playback speed.

#### Scenario: Change Speed

Given the play speed selector is visible
When the user selects a speed option (0.5×, 1×, 2×)
Then subsequent auto-advance steps SHALL use the new speed
