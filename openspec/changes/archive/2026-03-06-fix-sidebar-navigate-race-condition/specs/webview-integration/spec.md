## MODIFIED Requirements

### Requirement: Workspace path injection
The Webview SHALL receive the workspace path from the extension host so the React app can skip the repo selection page. Messages sent to the webview before the ready handshake completes SHALL be queued by the extension host and delivered after the init message is sent.

#### Scenario: Initial workspace path
- **WHEN** the Webview is created in a workspace with an `openspec/` directory
- **THEN** the extension host sends a `{ type: 'init', workspacePath: '/path/to/repo' }` message after the Webview is ready

#### Scenario: Webview ready handshake
- **WHEN** the React app finishes mounting in the Webview
- **THEN** it sends a `{ type: 'ready' }` message to the extension host to signal it can receive the workspace path

#### Scenario: Queued messages delivered after init
- **WHEN** a navigate or openSearch message is sent before the webview ready handshake completes
- **THEN** the extension host queues the message and delivers it after sending the init message
