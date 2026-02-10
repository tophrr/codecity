# Spec Delta: Data Ingestion

## ADDED Requirements

### Requirement: Git Log Parsing

The system SHALL parse git logs from a local repository to extract commit history.

#### Scenario: Parse Git Log

Given a local git repository path
When the parser runs
Then it should extract commit hash, author, date, and file changes (additions/deletions) for all commits
And save the result as a JSON file

### Requirement: Multi-repo Support

The system SHALL support aggregating logs from multiple repositories into a single timeline.

#### Scenario: Handle multiple repositories

Given a configuration with multiple repository paths
When the parser runs
Then it should aggregate logs from all repositories into a single timeline
