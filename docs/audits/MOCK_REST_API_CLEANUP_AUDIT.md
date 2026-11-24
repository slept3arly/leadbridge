# LeadBridge Mock REST API Cleanup Audit

Scope: `mock-rest-api/` and repository references needed to determine its role. Files were inspected without installing dependencies, starting the server, or making network requests. No secrets or environment values from local `.env` files were inspected. The requested report is the only file created for this audit.

## Inventory and recommendations

| File/component | Purpose | Dependencies/references | Current relevance | Recommendation | Risk |
|---|---|---|---|---|---|
| `mock-rest-api/.env.example` | Documents the mock server's configurable port and API key. Contains a local example value; the value is not repeated here. | Read by operators following the fixture setup instructions; server reads `PORT` and `MOCK_API_KEY`. | Useful for repeatable manual connector setup, but the server has a built-in fallback, so it is not required to start. | KEEP | Low if treated as a local-only example; the fallback is not suitable as a real credential. |
| `mock-rest-api/.gitignore` | Excludes installed dependencies, local `.env`, and npm debug logs while allowing the example env file. | Applies only to this standalone package directory. | Appropriate for local fixture development. | KEEP | Low. |
| `mock-rest-api/README.md` | Explains installation/start commands, configuration, three endpoint behaviors, response shape, and pagination. | Uses `npm install`, `npm start`, `npm run dev`; endpoint/port details are also described in `docs/rest-connector-testing.md`. | Provides standalone package usage; the more extensive canonical manual integration walkthrough lives in `docs/rest-connector-testing.md`. | KEEP | Low; two docs have some overlapping setup/endpoint descriptions that can drift. |
| `mock-rest-api/data/leads.js` | Supplies 18 static fictional lead objects, including records with absent optional contact fields. | Imported only by `server.js`; the records support pagination and connector normalization/import scenarios. | Useful fixture data; no database or application runtime dependency. | KEEP | Low. |
| `mock-rest-api/package.json` | Defines a private Node ESM Express service, `start` and watch-mode `dev` commands, Node engine minimum, and Express dependency. | Run from this directory using npm; no root package script or workspace declaration invokes it. | Intentional independent fixture runtime, not part of the LeadBridge application install/build. | KEEP | Low to medium; installing/running is separate from root pnpm tooling. |
| `mock-rest-api/package-lock.json` | Locks the standalone Express dependency tree for reproducible npm installs. | Paired with the nested package manifest and the documented `npm install` workflow. | Its presence is consistent with a standalone npm package not declared in `pnpm-workspace.yaml`; not evidence of accidental duplication. | KEEP | Low; it would become stale if the nested manifest changed without refreshing the lock. |
| `mock-rest-api/server.js` | Exposes a read-only Express fixture: paginated leads, API-key protected leads, and a deliberate HTTP 500 endpoint. Validates positive integer page numbers; starts on `0.0.0.0` at configured port or default port 4001. | Express and `data/leads.js`; manual setup documented in the mock README and `docs/rest-connector-testing.md`. `tests/phase1-hardening.test.ts` uses local HTTP fixtures for connector behavior but does not launch this server. | Useful for end-to-end manual REST connector configuration, authentication, pagination, and failure demonstrations. It is not imported by the application and is not required by automated tests. | KEEP | Medium: it listens on all interfaces and provides a built-in local API-key fallback; keep it limited to trusted local testing and use an explicit local key when exercising auth. |

## Findings

### Endpoints and operation

The server has three GET routes:

- `/api/leads?page=N` returns a page of five from the static 18-lead fixture and pagination metadata; invalid page values return 400.
- `/api/leads-auth?page=N` checks the `x-api-key` header, then returns the same page response or 401.
- `/api/leads-error` always returns a simulated upstream 500 response.

The server has no database, write endpoints, LeadBridge imports, or external-service calls. It reads `PORT` and `MOCK_API_KEY` from its environment, with local defaults. It binds to `0.0.0.0`; therefore the service can be reached beyond loopback depending on the host/network firewall.

It is started manually from the nested directory using `npm start` or `npm run dev` (which enables Node watch mode). The development guide at `docs/rest-connector-testing.md` supplies a workflow that runs this fixture and configures a LeadBridge REST connector against it. There is no application start hook, root package command, CI workflow, or automated test launcher for it.

### Repository references and dependencies

- Application source does not reference or depend on `mock-rest-api/`; no runtime feature requires it.
- `src/connectors/rest/` implements the generic REST connector. Its HTTP client, URL policy, response extraction, pagination, retries, and error handling are application code and operate against arbitrary configured HTTP APIs.
- `tests/phase1-hardening.test.ts` creates local HTTP fixtures in test code and covers URL policy, local development allowlisting, auth handling, response extraction, pagination, retries, and failures. This provides automated client/connector-level coverage without this Express server.
- The manual walkthrough in `docs/rest-connector-testing.md` explicitly depends on this directory for a repeatable end-to-end configuration/sync exercise. It records historical observations and distinguishes those from automated coverage.
- Outside documentation and the directory itself, the port `4001` appears in REST URL policy tests as a specifically allowlisted development origin. Those tests use their own local test fixtures; they do not launch the mock service. No other repository package script, source import, or workflow starts it.

### Separate npm package and duplication

The nested `package.json` is private, declares only Express, and owns its `start` and `dev` commands. The root `pnpm-workspace.yaml` has package build allowlists but no workspace package patterns; the root package also does not include Express as a dependency. The nested `package-lock.json` therefore supports the documented standalone `cd mock-rest-api && npm install` workflow. This is a coherent boundary for an optional fixture rather than duplicated root application dependencies.

Automated tests duplicate some behaviors at the protocol level using local HTTP test fixtures. They do not duplicate the human-friendly static service that operators can configure through the Admin UI and run through the actual sync workflow. No test imports `data/leads.js` or `server.js`.

## Questions answered

1. **Is it essential to the actual application?** No. The application does not depend on it at runtime.
2. **Is it only a development/testing utility?** Yes. It is a local mock service for manual development, connector configuration, and demonstrations.
3. **Does the REST connector require it?** No. The connector accepts configured external HTTP APIs. The mock is one convenient test target.
4. **Is its separate npm package setup intentional?** The repository evidence supports that: it is a private standalone Express app, has its own commands and lockfile, and the manual guide explicitly installs it from its own directory. There is no root workspace membership.
5. **If removed, what breaks?** No LeadBridge runtime feature or existing automated test should break. The documented manual end-to-end REST connector walkthrough loses its bundled repeatable server and fixed sample endpoints. Operators would need another HTTP fixture or a real test API. References in `docs/rest-connector-testing.md` and the mock README would become stale and must be handled during the later docs cleanup.
6. **Is there a better way to test the REST connector?** For automated behavior, the existing local HTTP fixtures in `tests/phase1-hardening.test.ts` are faster and do not need this package. For end-to-end UI plus connector-runtime validation, the mock remains valuable because it supplies deterministic paginated, authenticated, and failing responses without a third-party service. A replacement would need to preserve those scenarios; the current automated fixtures do not fully replace the documented manual sync workflow.

## Recommendation

**Retain the entire directory for now.** It is not required by production or automated tests, but it supports a documented, deterministic, end-to-end manual connector workflow that automated tests do not fully exercise. Its package separation is internally consistent. If the team no longer wants manual REST connector validation, removing it is technically low impact to the application, but would retire that workflow and require a later documentation update. Keep its server on a trusted local network and avoid relying on its built-in key fallback for security-sensitive testing.
