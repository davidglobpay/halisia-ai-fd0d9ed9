# HALISIA enhancement release

Date: 12 September 2026

## Implemented

- Added a provider-neutral server-side AI gateway.
- Added environment-driven provider, endpoint, authentication-header and model selection.
- Preserved the existing Lovable gateway as the zero-configuration fallback.
- Added bounded chat history and message lengths, JSON request validation, request timeout handling and sanitized upstream errors.
- Added `/system-status`, a noindex verification surface linking directly to the design system, assistant, spatial and responsive-navigation checks.
- Updated `/style-guide` from the obsolete dark palette to the approved HALISIA light-glass palette.
- Added unit coverage for custom/Astra-ready configuration, Lovable fallback and chat-input bounds.

## AI configuration

The application continues to work with its existing `LOVABLE_API_KEY`. To connect an OpenAI-compatible gateway or a future Astra endpoint, configure server-side deployment secrets:

```text
AI_GATEWAY_API_KEY=<server-side secret>
AI_GATEWAY_URL=<OpenAI-compatible chat-completions endpoint>
AI_GATEWAY_AUTH_HEADER=Authorization
AI_MODEL=<exact enabled model identifier>
AI_PROVIDER=<provider label shown in diagnostics>
```

Never prefix browser-exposed variables with `VITE_` for AI secrets.

## Verification

- Production build: PASS
- Typecheck: PASS
- Unit tests: 73/73 PASS across 10 files
- Protected spatial unit checks: PASS within the suite
- New-code formatting/lint: PASS
- Full-repository lint: 24 pre-existing Prettier errors remain in untouched files
- Browser preview: blocked by the execution environment's `uv_interface_addresses` system error; this is not an application build failure

## Test routes after staging deployment

- `/system-status`
- `/style-guide`
- `/token-audit`
- `/spatial`
- `/model-lab`
- `/explore`

## Publication requirement

Apply this source to the connected HALISIA GitHub/Lovable repository, configure secrets in the deployment environment, deploy to staging, run browser/device tests, and promote only after approval.
