import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { afterEach, describe, expect, it } from "vitest";

import { PrivacyVeil } from "../../app/s/[publicId]/viewer-parts/privacy-veil";

describe("privacy veil", () => {
  afterEach(() => {
    vi.restoreAllMocks?.();
  });

  it("starts revealed and toggles locally without leaving the page", () => {
    render(
      <PrivacyVeil>
        <p>secret payload</p>
      </PrivacyVeil>
    );

    const region = document.querySelector(".privacy-veil")!;
    expect(region.getAttribute("data-veiled")).toBe("false");
    expect(region.querySelector(".veil-content")!.getAttribute("aria-hidden")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Hide decrypted content" }));
    expect(region.getAttribute("data-veiled")).toBe("true");
    expect(screen.getByText("secret payload")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show decrypted content" }));
    expect(region.getAttribute("data-veiled")).toBe("false");
  });

  it("hides on Hide, Escape, and window blur", () => {
    render(
      <PrivacyVeil>
        <p>secret payload</p>
      </PrivacyVeil>
    );
    const region = document.querySelector(".privacy-veil")!;

    fireEvent.click(screen.getByRole("button", { name: "Hide decrypted content" }));
    expect(region.getAttribute("data-veiled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show decrypted content" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(region.getAttribute("data-veiled")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Show decrypted content" }));
    fireEvent.blur(window);
    expect(region.getAttribute("data-veiled")).toBe("true");
  });
});
