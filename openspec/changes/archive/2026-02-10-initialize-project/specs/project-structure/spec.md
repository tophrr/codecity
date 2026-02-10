# Project Structure

## ADDED Requirements

### Requirement: Root Configuration

The project SHALL have a root configuration including package.json, tsconfig.json, and vite.config.ts.

#### Scenario: Checking root files

- **Given** the project root
- **Then** `package.json` should exist
- **And** `tsconfig.json` should exist
- **And** `vite.config.ts` should exist
- **And** `.gitignore` should exist

### Requirement: Standard Source Directory Structure

The project SHALL have a standard source directory structure with src/components and src/main.tsx.

#### Scenario: Checking source directories

- **Given** the `src` directory
- **Then** `src/components` should exist
- **And** `src/systems` should exist
- **And** `src/types` should exist
- **And** `src/utils` should exist
- **And** `src/App.tsx` should exist
- **And** `src/main.tsx` should exist
