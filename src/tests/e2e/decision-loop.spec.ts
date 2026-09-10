import { test, expect } from "@playwright/test";

test.describe("full decision loop", () => {
  test.setTimeout(120_000);

  test("workspace → session → automatic workflow → decision → blueprint export", async ({
    page,
  }) => {
    await page.goto("/login");
    const bypass = page.getByRole("button", { name: /Dev Auth Bypass/i });
    if (!(await bypass.count())) {
      test.skip(true, "Connected Firebase mode — CI uses stub models + bypass");
    }
    await bypass.click();
    await expect(page.getByRole("heading", { name: "Workspaces" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("workspace-name").fill("ChallengeReady Lab");
    await page.getByTestId("domain-pack").selectOption("challengeready");
    await page.getByTestId("create-workspace").click();
    await expect(page.getByRole("heading", { name: "ChallengeReady Lab" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByTestId("session-title").fill("FTMO training product");
    await page.getByTestId("session-problem").fill(
      "I want to build a web application to help FTMO challenge traders train before taking the real challenge."
    );
    await page.getByTestId("session-objective").fill(
      "Choose an MVP that trains readiness without live trade execution."
    );
    await page.getByTestId("create-session").click();
    await expect(page).toHaveURL(/\/sessions\//, { timeout: 15_000 });

    // Mode remains visible; Intent must not be required in normal UI.
    await page.getByTestId("route-mode").selectOption("DEEP");
    await expect(page.getByTestId("workflow-stepper")).toBeVisible();
    await expect(page.getByTestId("deep-stage-hint")).toBeVisible();
    await expect(page.getByTestId("deep-stage-hint")).toContainText(/Analyst \(Gemini\)|CRITIQUE|Groq/);
    await expect(page.getByTestId("intent-select")).toBeHidden();

    await page.getByTestId("composer").fill(
      "I want to build a web application to help FTMO challenge traders train before taking the real challenge."
    );
    await page.getByTestId("auto-workflow").click();
    // The Composer swaps data-testid="auto-workflow" for
    // data-testid="stop-workflow" the instant the run starts (Composer.tsx),
    // so asserting text on the original testid here is a guaranteed race —
    // it never comes back before the whole multi-stage DEEP run finishes.
    // Assert on the state the click actually produces instead (H11 fix).
    await expect(page.getByTestId("stop-workflow")).toBeVisible();

    await expect(page.getByText(/Readiness Lab MVP/i).first()).toBeVisible({
      timeout: 90_000,
    });

    // Wait for workflow to finish advancing (approve button or paused/complete)
    await expect(
      page.getByTestId("approve-decision").or(page.getByTestId("auto-workflow"))
    ).toBeVisible({ timeout: 90_000 });

    // If still need prepare via advanced QA only when approve not visible yet
    if (!(await page.getByTestId("approve-decision").count())) {
      await page.getByTestId("advanced-controls").click();
      await page.getByTestId("intent-select").selectOption("PREPARE_DECISION");
      await page.getByTestId("composer").fill("Prepare the decision record draft.");
      await page.getByTestId("send-message").click();
    }

    await expect(page.getByTestId("approve-decision")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("approve-decision").click();
    await expect(page.getByTestId("generate-blueprint")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("generate-blueprint").click();
    await expect(page.getByTestId("approve-blueprint")).toBeVisible({
      timeout: 15_000,
    });
    await page.getByTestId("approve-blueprint").click();
    await expect(page.getByTestId("export-blueprint")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-blueprint").click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});
