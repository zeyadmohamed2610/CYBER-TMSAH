# Supabase Native Passkeys

## Current architecture — 3 October 2026

React/Vite uses `@supabase/supabase-js` 2.116 with `auth.experimental.passkey: true`. Supabase Auth owns registration challenges, credential storage, cryptographic verification and sessions. `@simplewebauthn/browser` presents the native browser ceremony without choosing an authenticator or password manager. The old custom registration, signature verifier, session exchange and credential-management endpoints have been removed.

The hosted project's native passkey API is enabled. Its RP ID is `www.cyber-tmsah.site`; the production origin is `https://www.cyber-tmsah.site`. Configure native passkeys in the Supabase Auth settings using these exact values. Do not change the RP ID casually: existing provider credentials are bound to it. Native passkeys are experimental; see [Supabase's official guide](https://supabase.com/docs/guides/auth/passkeys). Localhost and preview domains need their own compatible development Auth configuration; the production RP cannot register on localhost.

## Registration and management

A confirmed, signed-in account starts native registration. The browser adapter requires a discoverable credential and user verification. The primary profile action explicitly requests a platform authenticator with the client-device hint, keeping registration on the current device/provider. A separate action leaves attachment unrestricted for other-device and security-key registration. A failed local request never silently retries on an external device. Neither action selects a vendor or biometric method. Supabase verifies and stores the registration. Profile management uses native `auth.passkey.list`, `update` and `delete`, including friendly names and last-used dates. Native metadata UUIDs are distinct from WebAuthn credential IDs. Multiple keys belong to each account; no private keys or biometric information enter the application database.

The profile asks for password confirmation, prepares native registration options, then waits for a separate final click to invoke the device prompt. This final click does not wait for another session or challenge fetch. Prepared requests expire locally after two minutes and remain subject to native server verification. A capability-check button reports whether the browser detects a local user-verifying authenticator; unavailable/unknown checks never silently select another device or weaken verification. Device errors are classified separately from network errors, including wrapped DOM exceptions. The profile still asks for password confirmation before adding a key. This is an application UI check; Supabase's native registration endpoint independently requires an authenticated, confirmed account. Do not describe the UI check as a server-enforced recent-password policy.

## Login and verification

Login starts a native discoverable authentication challenge without requiring an email. The browser requests user verification as `required`. The `passkey-login` bridge rejects assertions without signed user-presence and user-verification flags, then forwards the unchanged assertion to Supabase Auth for challenge, origin, RP ID, public-key signature and credential/account verification. Only Supabase's freshly verified session is returned and installed in the browser.

The native service currently generates options with user verification `preferred`. The application's bridge enforces `required` for its login and attendance paths; this does not imply that every direct Supabase Auth endpoint globally rejects presence-only authentication. The bridge never alters signed flags or bypasses cryptographic verification.

Settings and attendance use separate, two-minute, single-use bindings to the signed-in account and ceremony purpose. Settings additionally bind the selected native key. Attendance binds the six-digit attendance code and device fingerprint. A verified native assertion for another account is refused. Temporary verification sessions are signed out locally on the server and never replace the browser's original session.

Attendance receives a short-lived receipt consumed once by the existing attendance rules. A foreign key to the native Auth credential revokes unused receipts when that key is deleted. The service-only lookup maps a WebAuthn ID to its owner's native key; clients cannot call it or write request bindings. Historical attendance is retained.

## Sessions and migration

The SPA uses Supabase's browser session storage, not HttpOnly cookies. Bearer tokens authorize backend requests. Browser storage holds session data; credentials remain in Supabase Auth and the OS/provider. Clearing cookies or website data logs the user out without removing the provider's passkey. Sign-out does not delete credentials.

The migration adds native attendance bindings and receipt revocation. Legacy tables remain as migration history, with client privileges revoked; live custom credential and pending-proof data are cleared during the authorized reset. Accounts and recorded attendance must remain unchanged. Every affected user must sign in with a password and add a new passkey. Removing a server credential does not remove its copy from a device/password manager.

## Verification and remaining device checks

Automated tests cover required verification, account/key/purpose binding, challenge expiry/replay, changed attendance code/device, server errors, fresh sessions and native-key receipt revocation. A live ES256 registration/assertion test verifies actual Supabase registration, login, settings confirmation, presence-only rejection and deletion of outstanding attendance receipts.

The live browser suite covers the five roles on desktop/mobile viewports, native registration and metadata, settings verification, fresh login and student attendance. Browser-restart cases clear cookies and origin storage, close Chrome, restore only the virtual provider vault and authenticate again. After production deployment, all twelve live cases passed (six desktop and six mobile viewport cases), including student attendance and two browser restarts. All 227 unit/integration tests, lint, TypeScript checks and production build passed; GitHub CI and Vercel deployment succeeded. Supabase error-level security advisors reported no issues. QA native keys, request bindings, attendance proofs and device locks were removed; the published second-year schedule still contains 266 entries. Virtual authenticators are not physical device certification.

Physical acceptance remains necessary on Android providers, iPhone/iPad Safari, Windows Hello fingerprint/face/PIN, desktop password managers and browser-managed cross-device flows. A device returning flags `25` still lacks signed user verification and is refused even if it displayed a fingerprint prompt. Registering a replacement key is necessary after the reset; migration alone cannot guarantee that a provider will return the required signed verification flag.
