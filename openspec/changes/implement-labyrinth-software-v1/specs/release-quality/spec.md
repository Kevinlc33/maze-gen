# Spec Delta

## Purpose

Defines release acceptance, accessibility, browser compatibility, and static-deployment behavior for the Version 1 application.

## ADDED Requirements

### Requirement: Supported browser compatibility
The application SHALL support current stable releases of Chrome, Firefox, and Edge.

#### Scenario: Application opens in a supported browser
- **WHEN** the static application loads in Chrome, Firefox, or Edge
- **THEN** core generation, rendering, export, persistence, and sharing workflows SHALL operate without backend services

### Requirement: Iframe delivery
The application SHALL adapt to its embedding container and SHALL remain usable in iframe layouts.

#### Scenario: Container width changes
- **WHEN** the containing iframe or window is resized
- **THEN** the sidebar and viewport SHALL adapt without corrupting geometry or project state

### Requirement: Correctness claims are traceable
No result SHALL be presented as mathematically proven unless the applicable geometry and finite-state verification result is conclusive.

#### Scenario: Incomplete verification is shown
- **WHEN** verification is cancelled or resources are exhausted
- **THEN** the interface SHALL show Verification Incomplete and SHALL not claim exact solvability

### Requirement: Acceptance verification
Version 1 SHALL have unit, property, adversarial geometry, independent reference, integration, and end-to-end coverage for the implemented requirements.

#### Scenario: Release review begins
- **WHEN** implementation is complete
- **THEN** applicable tests SHALL pass and any unimplemented or unsupported requirement SHALL be explicitly documented rather than implied

### Requirement: Extensible architecture
Core modules SHALL preserve enough stable boundaries for future multi-level generation without making a level required in Version 1.

#### Scenario: A level identifier is represented
- **WHEN** the domain model is created
- **THEN** it SHALL support exactly one V1 level and SHALL not block future level expansion

### Requirement: Definition of done
A story SHALL require passing acceptance criteria and applicable automated tests, successful lint and TypeScript build, actionable invalid-input handling, updated documentation, preserved physical and logical integrity, and PRD review.

#### Scenario: A story is considered complete
- **WHEN** implementation and verification finish
- **THEN** no known critical correctness defect SHALL remain and the static application SHALL be deployable
