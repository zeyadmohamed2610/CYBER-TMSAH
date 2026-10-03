// Run the current native-passkey browser suite, including real student attendance.
// Secrets and dedicated QA credentials are read locally by the shared runner.
process.env.E2E_LIVE_SUITE = 'passkeys';
process.env.E2E_BASE_URL ??= 'https://www.cyber-tmsah.site';
await import('./run-live-role-tests.mjs');
