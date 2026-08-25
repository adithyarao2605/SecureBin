import { expect, test } from "@playwright/test";

// Full encrypted-discussion round trip on the real backend: the composer
// seals a discussion capability into the SBCT frame, only its digest reaches
// the server, and a revealed recipient posts/edits/deletes encrypted replies.
// Requires `pnpm supabase:start`.

const NOTE = "Discussion round trip: replies stay end-to-end encrypted.";

test("revealed recipients hold an encrypted discussion", async ({ page }) => {
  test.setTimeout(90_000);

  const postBodies: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/comments")) {
      postBodies.push(request.postData() ?? "");
    }
  });

  await page.goto("/new");
  await page.getByLabel("Note content").fill(NOTE);
  await page.getByText("Customize policy", { exact: true }).click();
  await page
    .getByRole("group", { name: "How many times can the ciphertext be released?" })
    .getByText("3 reveals")
    .click();
  await page.getByRole("checkbox", { name: /Enable encrypted discussion/i }).check();
  await page.getByRole("button", { name: "Create share" }).click();
  const shareLinkInput = page.getByRole("textbox", { name: "Share link" });
  await expect(shareLinkInput).toBeVisible({ timeout: 30_000 });

  // ZK assertion: comment posts carry ciphertext envelopes, never plaintext
  // bodies or the raw capability in any logged request we can observe here.
  await page.goto(await shareLinkInput.inputValue());
  const revealButton = page.getByRole("button", { name: "Reveal" });
  await expect(revealButton).toBeVisible({ timeout: 20_000 });
  await revealButton.click();
  await page.getByRole("button", { name: "Yes, reveal now" }).click();

  const thread = page.getByLabel("Encrypted discussion");
  await expect(thread).toBeVisible({ timeout: 20_000 });
  await expect(thread.getByText("No comments yet.")).toBeVisible({ timeout: 30_000 });

  // Post a top-level comment with a nickname.
  const form = thread.locator("form").last();
  await form.getByPlaceholder("Write a reply…").fill("First sealed reply");
  await form.getByPlaceholder("Nickname (optional)").fill("Verifier");
  await form.getByRole("button", { name: "Post" }).click();

  const parentComment = thread.locator(".discussion-comment").filter({
    has: page.getByText("First sealed reply"),
  });
  await expect(parentComment).toBeVisible({ timeout: 15_000 });
  await expect(thread.getByText("Verifier")).toBeVisible();
  // Replies nest inside the parent's <li>; these selectors target each
  // comment's OWN action row, not an ancestor's.
  const parentActions = parentComment.locator(":scope > .discussion-actions");

  // Reply to it, then delete the parent; the reply survives as an orphan.
  await parentActions.getByRole("button", { name: "Reply" }).click();
  await form.getByPlaceholder("Write a reply…").fill("Nested answer");
  await form.getByRole("button", { name: "Post" }).click();

  const childComment = thread
    .locator(".discussion-comment")
    .filter({ has: page.getByText("Nested answer") })
    .last();
  const childActions = childComment.locator(":scope > .discussion-actions");
  await expect(childComment).toBeVisible({ timeout: 15_000 });

  // Both comments are fully rendered (with their action rows) before any
  // further interaction, so mutations never race a refetch mid-render.
  await expect(parentActions.getByRole("button", { name: "Delete comment" })).toBeVisible();
  await expect(childActions.getByRole("button", { name: "Delete comment" })).toBeVisible();

  await parentActions.getByRole("button", { name: "Delete comment" }).click();
  await expect(parentActions.getByRole("button", { name: "Delete comment" })).toBeVisible();
  await parentActions.getByRole("button", { name: "Delete comment" }).click();
  await expect(thread.getByText("Comment deleted")).toBeVisible({ timeout: 15_000 });
  await expect(thread.getByText("Nested answer")).toBeVisible();

  // Edit the surviving comment; "(edited)" appears after save.
  await childActions.getByRole("button", { name: "Edit comment" }).click();
  await page.getByLabel("Edit comment").fill("Nested answer (revised)");
  await thread.getByRole("button", { name: "Save edit" }).click();
  await expect(thread.getByText("Nested answer (revised)")).toBeVisible({ timeout: 15_000 });
  await expect(thread.getByText("(edited)").first()).toBeVisible();

  // Every observed comment POST carried opaque envelopes only — never
  // plaintext. (POST bodies carry the raw capability by contract, like
  // DELETE's body; GET alone uses the header so nothing capability-shaped
  // lands in a URL.)
  for (const body of postBodies) {
    expect(body).not.toContain("First sealed reply");
    expect(body).not.toContain("Nested answer");
    expect(body).not.toContain("Verifier");
  }
});
