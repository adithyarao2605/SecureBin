import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { PrivacyVeil } from "../../app/s/[publicId]/viewer-parts/privacy-veil";

describe("privacy veil", () => {
  afterEach(() => {
    vi.restoreAllMocks?.();
  });

  it("starts veiled and toggles locally without leaving the page", () => {
    render(
      <PrivacyVeil>
        <p>secret payload</p>
      </PrivacyVeil>
    );

    const region = document.querySelector(".privacy-veil")!;
    expect(region.getAttribute("data-veiled")).toBe("true");
    expect(region.querySelector(".veil-content")!.getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show decrypted content" }));
    expect(region.getAttribute("data-veiled")).toBe("false");
    expect(screen.getByText("secret payload")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Hide decrypted content" }));
    expect(region.getAttribute("data-veiled")).toBe("true");
  });

  it("re-hides on Escape and on window blur", () => {
    render(
      <PrivacyVeil>
        <p>secret payload</p>
      </PrivacyVeil>
    );
    const region = document.querySelector(".privacy-veil")!;

    fireEvent.click(screen.getByRole("button", { name: "Show decrypted content" }));
    expect(region.getAttribute("data-veiled")).toBe("false");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(region.getAttribute("data-veiled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show decrypted content" }));
    fireEvent.blur(window);
    expect(region.getAttribute("data-veiled")).toBe("true");
  });
});
