import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import { dashboardTabs } from "../../auth/utils/roleAccess";
import { useDashboardTab } from "./useDashboardTab";
it("redirects removed student subject-list tabs to the schedule without affecting faculty tabs", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  function Probe() {
    const [tab] = useDashboardTab("schedule", dashboardTabs("student"));
    return <span>{tab}</span>;
  }
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/student-panel?tab=analytics"]}>
        <Probe />
      </MemoryRouter>,
    ),
  );
  expect(container.textContent).toBe("schedule");
  expect(dashboardTabs("student")).toEqual(["checkin", "records", "schedule"]);
  expect(dashboardTabs("doctor")).toContain("subjects");
  expect(dashboardTabs("ta")).toContain("subjects");
  await act(async () => root.unmount());
});
