# Passkey implementation and acceptance

## Architecture inspected before implementation

The application is a React 18/Vite SPA, served over HTTPS by Vercel at `https://www.cyber-tmsah.site`. Supabase Auth manages password sign-in, sign-out, JWT refresh and browser sessions. The browser uses `@simplewebauthn/browser` 13.3.0. The Supabase `passkey-login` Edge Function uses `@simplewebauthn/server` 13.3.2 and `@supabase/server` 1.8.0. Credentials, expiring challenges and short-lived attendance receipts live in separate Postgres tables.

Supabase's SPA session storage is browser-accessible, not an HttpOnly cookie. No private key or biometric is stored there. An HttpOnly session architecture would require a same-origin backend/session proxy and corresponding API authorization changes; this release does not pretend to implement one. Requests use bearer tokens rather than automatically attached authentication cookies. Verified authentication assertions create a new Supabase session via a server-generated one-time token exchange.

## Implementation plan and resulting changes

- Preserve the shared registration/authentication adapter and mature cryptographic library; add no vendor-specific authentication branches or dependencies.
- Expand account capacity from two to ten keys in `registration.ts`, the profile UI and the advisory-lock-protected database trigger. The migration replaces only the limit function; existing keys and attendance remain intact.
- Create `management.ts` for authenticated, ownership-bound display-name changes. Direct client insertion or cryptographic-column updates remain forbidden. Only `device_name` can change through this endpoint.
- Extend the profile with rename, creation date and last-used date. Labels do not infer the credential's provider from the current browser's user agent.
- Reject unapproved HTTP request origins before generating challenges. Limit verification RP IDs to the current site's valid identity, retaining parent-domain credentials on the www domain. Local development remains explicitly restricted to loopback origins.
- Extend cryptographic tests, a database capacity test and browser tests for metadata, storage deletion and fresh-session creation after browser restart.

## Registration, authentication and attendance

Registration requires an authenticated account and a recent password verification in the same signed session. The server generates a random, expiring registration challenge and discoverable-credential options with user verification required. No authenticator attachment or vendor is forced. The native provider can offer a local authenticator, synced manager, another device or compatible security key. The server independently verifies registration, consumes the exact challenge once and stores the public key, credential ID, counter, transports and metadata.

Login accepts a discoverable credential without requiring an identifier or password. An optional identifier restricts account selection. The server checks the issued challenge, origin, RP ID, credential ownership, signed authenticator data, signature, user verification and applicable counter state. A verified login issues a one-time Supabase session exchange token. No cached token is accepted as evidence of passkey authentication.

Settings verification returns only confirmation of the account's key. Attendance requires the signed-in account and attendance-code-specific challenge, and issues a short-lived receipt bound to the account, code and device fingerprint. The attendance RPC consumes it once with its other attendance rules. Challenges from one purpose cannot be used for another. Removing a credential revokes outstanding attendance receipts for that credential and does not delete historical attendance.

Clearing website cookies, storage, IndexedDB or caches removes session data, not credentials in the provider or database. Normal sign-out does not revoke a passkey. Explicit removal from the platform is different: it disables acceptance of that key here, even if the provider still lists it.

## Verification evidence and limits

On 3 October 2026, lint, TypeScript checks, production build and all 242 unit/integration tests passed. Twelve live-backend browser cases passed: ten role/viewport cases and two browser-restart cases. The live database limit function was checked after deployment, and Supabase's error-level security advisors reported no issues. Initial browser-test failures were caused by a too-short network wait and an incorrect expected sign-out route; the corrected cases were rerun successfully.

Automated unit/integration checks cover authentic signatures, synced flags, missing user verification, incorrect challenge/origin/RP/signature, wrong accounts, wrong ceremony purpose, expiry, replay, concurrent consumption, counters, recent registration reauthentication, revocation, invalid names and account-wide capacity. The PGlite capacity check accepts ten keys, rejects the eleventh and verifies that removing a key frees capacity.

Browser tests run against the live Supabase service with dedicated QA accounts for all five roles, desktop and mobile viewports, including registration, verification, rename, storage deletion, login and student attendance. A separate test registers a key, logs in, logs out, clears cookies and all origin storage, closes Chrome, reopens Chrome and logs in again. CDP virtual-authenticator state is exported/imported outside website storage to simulate a persistent OS/provider vault. This demonstrates website-storage independence; it is not a physical provider/hardware certification.

The following physical acceptance checks remain required and must not be reported as passed without device evidence:

- Android Chrome with Google Password Manager, fingerprint, available face verification, PIN/screen lock and an alternate supported provider.
- iPhone/iPad Safari with Apple Passwords/iCloud Keychain, Face ID, Touch ID where available and device passcode.
- Windows Chrome and Edge with Windows Hello fingerprint, supported face verification and PIN, including a machine without biometric hardware.
- Supported desktop Google Password Manager, Microsoft Password Manager and Apple Passwords environments.
- Native computer-to-phone and phone-to-computer flows where the browser supports them.
- The full cookie/site-data deletion and browser-restart sequence with a physical provider that retains the key.

Do not disable user verification, modify authenticator flags or substitute a client-side success flag to make a failing device appear compatible. The reported real-device response with flags `25` contains presence/backup flags but lacks user verification; it must still be rejected. A provider identifier is diagnostic metadata, not proof that a specific vendor is defective. This release does not claim that the reported physical-device issue is resolved.

## Reproducing automated checks

Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`. With dedicated QA credentials and a local, ignored admin-key file configured as in the existing live runner, set `E2E_LIVE_SUITE=passkeys` and run `node scripts/run-live-role-tests.mjs`. For an additional security-key simulation set `E2E_PASSKEY_TRANSPORT=usb`. The runner removes only the known QA credentials, attendance fixtures and device locks. Never substitute a real account for a QA account.
