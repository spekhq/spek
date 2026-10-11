# Spec Delta

## ADDED Requirements

### Requirement: Select a spec by full topic path
The web API SHALL accept `GET /api/openspec/specs?dir=<repo>&topic=<full-topic>` for spec detail and the same request with `at=<change-slug>` for version content. The specs request without `topic` SHALL remain the list endpoint. Existing single-level detail and version routes SHALL retain their responses, and SHALL apply the same topic and slug validation, because their path parameters are decoded and can carry `/` and `..` once percent-decoded. Malformed topic paths, malformed change slugs, or `at` without `topic` SHALL return HTTP 400, and well-formed missing specs or versions SHALL return HTTP 404.

#### Scenario: List nested topics
- **WHEN** the main specs tree contains `contracts/pagination/spec.md` and its `streaming-search` child spec
- **THEN** `GET /api/openspec/specs?dir=<repo>` returns both full topic paths as separate entries

#### Scenario: Get nested detail
- **WHEN** client requests `GET /api/openspec/specs?dir=<repo>&topic=contracts%2Fpagination`
- **THEN** the response contains the detail for `contracts/pagination`, including its history

#### Scenario: Get nested version
- **WHEN** client requests `GET /api/openspec/specs?dir=<repo>&topic=contracts%2Fpagination&at=add-pagination`
- **THEN** the response contains that change's delta content for `contracts/pagination`

#### Scenario: Invalid topic and missing version
- **WHEN** a client requests an escaping topic path
- **THEN** the API returns HTTP 400 without reading outside the specs tree
- **AND** a valid topic with an absent version returns HTTP 404

#### Scenario: Invalid version selector
- **WHEN** a client supplies `at` without `topic` or a change slug containing a path separator
- **THEN** the API returns HTTP 400

#### Scenario: Existing flat detail route remains available
- **WHEN** a client requests `/api/openspec/specs/user-auth?dir=<repo>` or `/api/openspec/specs/user-auth/at/add-auth?dir=<repo>`
- **THEN** the existing single-level endpoint and response remain available

#### Scenario: Legacy route rejects an encoded escaping topic
- **WHEN** a client requests `/api/openspec/specs/..%2F..%2Fsecret?dir=<repo>`
- **THEN** the API returns HTTP 400 and reads no file outside the specs tree
