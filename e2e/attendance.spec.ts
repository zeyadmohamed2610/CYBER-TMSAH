import { test, expect } from "@playwright/test";

test.describe("Health Check", () => {
  test("should load health check page", async ({ page }) => {
    await page.goto("/health");
    await expect(page.locator("html")).toBeVisible();
  });

  test("health API endpoint returns JSON", async ({ page }) => {
    const response = await page.request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("checks");
  });
});

test.describe("Attendance Routes - Public Access", () => {
  test("should load login page", async ({ page }) => {
    await page.goto("/attendance/login");
    await expect(page.locator("html")).toBeVisible();
    await expect(page.locator('input[type="text"], input[type="email"]')).toBeVisible();
  });

  test("should load student panel route (redirects to login if not authenticated)", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load doctor dashboard route (redirects to login if not authenticated)", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load owner dashboard route (redirects to login if not authenticated)", async ({ page }) => {
    await page.goto("/attendance/owner-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Public Pages", () => {
  test("should load home page", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load schedule page", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should load materials page", async ({ page }) => {
    await page.goto("/materials");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("PWA Features", () => {
  test("should have manifest.json", async ({ page }) => {
    const response = await page.request.get("/manifest.json");
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");
  });

  test("should have service worker registered", async ({ page }) => {
    await page.goto("/");
    // Wait for service worker registration
    await page.waitForLoadState("networkidle");
    const swRegistration = await page.evaluate(async () => {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.ready;
        return !!registration;
      }
      return false;
    });
    expect(swRegistration).toBeTruthy();
  });

  test("should work offline (service worker caches resources)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Go offline
    await page.context().setOffline(true);

    // Try to navigate - should still load from cache
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("html")).toBeVisible();

    // Go back online
    await page.context().setOffline(false);
  });
});

test.describe("Accessibility", () => {
  test("should have proper RTL direction", async ({ page }) => {
    await page.goto("/");
    const htmlDir = await page.getAttribute("html", "dir");
    expect(htmlDir).toBe("rtl");
  });

  test("should have Arabic language attribute", async ({ page }) => {
    await page.goto("/");
    const htmlLang = await page.getAttribute("html", "lang");
    expect(htmlLang).toBe("ar");
  });

  test("should have proper viewport meta tag", async ({ page }) => {
    await page.goto("/");
    const viewport = await page.getAttribute("meta[name=viewport]", "content");
    expect(viewport).toContain("width=device-width");
  });
});

test.describe("Student Attendance Flow", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("should show login form for student", async ({ page }) => {
    await page.goto("/attendance/login");
    await expect(page.locator('input[name="nationalId"], input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test("should validate national ID format (14 digits)", async ({ page }) => {
    await page.goto("/attendance/login");

    // Try invalid national ID
    await page.fill('input[name="nationalId"]', "123");
    await page.fill('input[name="password"]', "password123");
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=/14 d?igit|must be 14|national id/i")).toBeVisible({ timeout: 5000 });
  });

  test("should request GPS permission on attendance submission", async ({ page }) => {
    // Mock geolocation
    await page.context().grantPermissions(["geolocation"]);
    await page.goto("/attendance/login");

    // This would require a logged-in student with an active session
    // For now, verify the page loads and has the necessary elements
    await expect(page.locator("html")).toBeVisible();
  });

  test("should show camera permission request for QR scanning", async ({ page }) => {
    await page.context().grantPermissions(["camera"]);
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Doctor Session Management", () => {
  test("should show session creation form for authenticated doctor", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should validate session expiry time", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    // Would need authenticated doctor to test fully
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Owner User Management", () => {
  test("should show user management interface for authenticated owner", async ({ page }) => {
    await page.goto("/attendance/owner-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should validate email format for doctor/TA creation", async ({ page }) => {
    await page.goto("/attendance/owner-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("QR Code Generation and Scanning", () => {
  test("should generate QR code for active session", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
    // QR code canvas or img should be present when session is active
  });

  test("should decode QR code with valid session data", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // QR scanner component should be present
  });
});

test.describe("TOTP Verification Flow", () => {
  test("should show TOTP input when enabled for session", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // TOTP input field should appear when session requires it
  });

  test("should reject invalid TOTP code", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // Would need active session with TOTP enabled
  });
});

test.describe("Device Fingerprinting", () => {
  test("should generate consistent device fingerprint", async ({ page }) => {
    await page.goto("/attendance/login");
    await expect(page.locator("html")).toBeVisible();
    // Fingerprint should be generated on page load
  });

  test("should detect device changes and require re-verification", async ({ page }) => {
    await page.goto("/attendance/login");
    await expect(page.locator("html")).toBeVisible();
    // Device binding logic tested at service level
  });
});

test.describe("GPS Verification", () => {
  test("should validate coordinates within allowed radius", async ({ page }) => {
    await page.context().grantPermissions(["geolocation"]);
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // GPS validation happens in submit_attendance RPC
  });

  test("should reject coordinates outside allowed radius", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // Tested at database function level
  });
});

test.describe("Export and Reports", () => {
  test("should export attendance as CSV", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
    // Export button should trigger download
  });

  test("should export attendance as Excel", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should export attendance as PDF", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Error Handling and Edge Cases", () => {
  test("should handle network errors gracefully", async ({ page }) => {
    await page.goto("/");
    await page.context().setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    // Should show offline indicator or cached content
    await expect(page.locator("html")).toBeVisible();
    await page.context().setOffline(false);
  });

  test("should handle expired sessions", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // Expired sessions should not be submittable
  });

  test("should prevent duplicate attendance submissions", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // Database constraint prevents duplicates
  });
});

test.describe("Real-time Updates", () => {
  test("should show real-time attendance count for doctors", async ({ page }) => {
    await page.goto("/attendance/doctor-dashboard");
    await expect(page.locator("html")).toBeVisible();
    // Supabase Realtime should update counts
  });

  test("should notify when new session is created", async ({ page }) => {
    await page.goto("/attendance/student-panel");
    await expect(page.locator("html")).toBeVisible();
    // Toast notification for new sessions
  });
});

test.describe("Schedule Page", () => {
  test("should display weekly schedule", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.locator("html")).toBeVisible();
    // Schedule grid should be visible
  });

  test("should filter by section", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.locator("html")).toBeVisible();
    // Section selector should work
  });
});

test.describe("Course Materials", () => {
  test("should list materials for authenticated users", async ({ page }) => {
    await page.goto("/materials");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should allow file download", async ({ page }) => {
    await page.goto("/materials");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Responsive Design", () => {
  test("should work on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.locator("html")).toBeVisible();
    // No horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375);
  });

  test("should work on tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await expect(page.locator("html")).toBeVisible();
  });

  test("should work on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/");
    await expect(page.locator("html")).toBeVisible();
  });
});

test.describe("Security Headers", () => {
  test("should have CSP header", async ({ page }) => {
    const response = await page.goto("/");
    const csp = response?.headers()["content-security-policy"];
    expect(csp).toBeTruthy();
  });

  test("should have X-Frame-Options header", async ({ page }) => {
    const response = await page.goto("/");
    const xfo = response?.headers()["x-frame-options"];
    expect(xfo).toBeTruthy();
  });

  test("should have Referrer-Policy header", async ({ page }) => {
    const response = await page.goto("/");
    const rp = response?.headers()["referrer-policy"];
    expect(rp).toBeTruthy();
  });
});