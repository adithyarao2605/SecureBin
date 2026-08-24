import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PolicyControls } from "../../app/components/policy-controls";
import { defaultPolicyDraft } from "../../lib/shares/policy-ui";

describe("release-window information disclosure", () => {
  it("keeps the explanation behind an accessible information button", () => {
    render(<PolicyControls draft={defaultPolicyDraft()} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText("Customize policy", { exact: true }));

    const info = screen.getByRole("button", { name: "About release windows" });
    expect(info).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/first server-authorized ciphertext release/iu)).not.toBeInTheDocument();

    fireEvent.click(info);
    expect(info).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/first server-authorized ciphertext release/iu)).toBeVisible();
  });
});
