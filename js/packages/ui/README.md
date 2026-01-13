# @datarecce/ui

Shared UI library for Recce OSS and Recce Cloud.

## Environment overrides

@datarecce/ui ships defaults for public URLs, but you can override them via Next.js env vars:

- `NEXT_PUBLIC_API_URL` - overrides the default API base URL.
- `NEXT_PUBLIC_RECCE_SUPPORT_CALENDAR_URL` - overrides the support calendar URL.

These values are read from `process.env` at runtime in the host app.
