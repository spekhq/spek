## ADDED Requirements

### Requirement: Plugin Verifier compatibility gate
The publish workflow SHALL run IntelliJ Plugin Verifier against a configured set of IDE builds before publishing, and
SHALL fail the workflow on verification problems. The configured set SHALL include both ends of the supported range:
the oldest supported build (`since-build`) and the newest released IntelliJ Platform build.

#### Scenario: Verification passes
- **WHEN** Plugin Verifier reports no compatibility problems for every configured IDE build
- **THEN** the workflow SHALL proceed to publish

#### Scenario: Verification fails
- **WHEN** Plugin Verifier reports a compatibility problem for any configured IDE build
- **THEN** the workflow SHALL fail
- **AND** the plugin SHALL NOT be published

#### Scenario: Newest platform build is covered
- **WHEN** the verification target list is configured
- **THEN** it SHALL include the newest released IntelliJ Platform build, so that a platform change breaking the plugin
  is detected before release rather than by users

### Requirement: Documented limits of the verification gate
The limits of the verification gate SHALL be recorded rather than assumed away, and a compensating check SHALL be
identified for each of them. Plugin Verifier checks class resolution and API usage; it does not exercise UI behavior,
so some classes of breakage cannot be caught by the gate at all.

#### Scenario: Gate cannot detect a known failure mode
- **WHEN** Plugin Verifier is found not to report a failure mode the project cares about
- **THEN** that limitation SHALL be documented
- **AND** a compensating check SHALL be named, such as a unit test or a manual run on a real IDE
