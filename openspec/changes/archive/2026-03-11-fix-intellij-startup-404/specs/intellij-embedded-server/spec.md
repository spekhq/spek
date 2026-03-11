## ADDED Requirements

### Requirement: API handler readiness check before webview load
The plugin SHALL verify that `SpekHttpRequestHandler` is responding to HTTP requests before loading the webview URL in JCEF. This ensures the frontend does not encounter HTTP 404 errors due to the handler not being registered yet.

#### Scenario: Handler becomes ready before timeout
- **WHEN** the built-in server has started
- **AND** `SpekBrowserPanel` polls the API health check endpoint
- **AND** the handler responds with HTTP 200 within the timeout period
- **THEN** the panel SHALL proceed to load the webview URL

#### Scenario: Handler not ready yet
- **WHEN** the built-in server has started
- **AND** the API health check endpoint returns non-200 or connection fails
- **THEN** the panel SHALL wait 200ms and retry the health check
- **AND** the panel SHALL check the `disposed` state before each retry

#### Scenario: Timeout exceeded
- **WHEN** the health check has been retried for more than 10 seconds without success
- **THEN** the panel SHALL proceed to load the webview URL as a fallback
- **AND** the panel SHALL log a warning about the timeout
