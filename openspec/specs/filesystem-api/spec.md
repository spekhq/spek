## Purpose

提供受限的檔案系統 API（目錄瀏覽、openspec 偵測），僅暴露 openspec/ 子目錄內容以確保安全。

## Requirements
### Requirement: Browse directories
The system SHALL provide an API endpoint `GET /api/fs/browse` that returns directory contents for a given path, allowing users to navigate the filesystem to find repos.

#### Scenario: Browse valid directory
- **WHEN** client sends `GET /api/fs/browse?path=/home/user/projects`
- **THEN** system returns a JSON array of entries, each with `name`, `type` ("file" or "directory"), and `path`
- **AND** entries are sorted with directories first, then alphabetically

#### Scenario: Browse without path parameter
- **WHEN** client sends `GET /api/fs/browse` without a `path` parameter
- **THEN** system returns the contents of the user's home directory

#### Scenario: Browse non-existent directory
- **WHEN** client sends `GET /api/fs/browse?path=/nonexistent`
- **THEN** system returns HTTP 400 with an error message

### Requirement: Detect OpenSpec directory
The system SHALL provide an API endpoint `GET /api/fs/detect` that checks whether a given path contains a valid OpenSpec directory. Detection SHALL first check for `openspec/config.yaml`. If `config.yaml` does not exist, the system SHALL fallback to checking whether `openspec/specs/` or `openspec/changes/` directory exists.

#### Scenario: Path contains valid OpenSpec directory with config.yaml
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/my-repo`
- **AND** `/home/user/my-repo/openspec/config.yaml` exists
- **THEN** system returns `{ "hasOpenSpec": true, "schema": "<schema-value>" }`

#### Scenario: Path contains OpenSpec directory without config.yaml
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/my-repo`
- **AND** `/home/user/my-repo/openspec/config.yaml` does not exist
- **AND** `/home/user/my-repo/openspec/specs/` or `/home/user/my-repo/openspec/changes/` exists
- **THEN** system returns `{ "hasOpenSpec": true, "schema": "unknown" }`

#### Scenario: Path does not contain OpenSpec directory
- **WHEN** client sends `GET /api/fs/detect?path=/home/user/empty-repo`
- **AND** no `openspec/` directory exists at that path, or `openspec/` exists but contains neither `specs/` nor `changes/`
- **THEN** system returns `{ "hasOpenSpec": false }`

### Requirement: Path traversal protection
The system SHALL reject any path that attempts directory traversal outside the specified root.

#### Scenario: Path traversal attempt
- **WHEN** client sends `GET /api/fs/browse?path=/home/user/../../../etc`
- **THEN** system resolves the path and returns the directory contents of the resolved absolute path without exposing system files outside normal filesystem permissions
