import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrivacyReceipt, type PrivacyReceiptData } from "../../app/components/privacy-receipt";

const baseReceipt: PrivacyReceiptData = {
  publicId: "AQEBAQEBAQEBAQEBAQEBAQ",
  fingerprint: "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345",
  mask: "link+password",
  hasFile: false,
  availableAt: null,
  expiresAt: "2026-09-01T00:00:00Z",
  maxReveals: 3,
  algorithm: "AES-256-GCM",
  kdf: "PBKDF2-HMAC-SHA-256",
  envelopeVersion: 2,
};

describe("Privacy receipt", () => {
  it("renders technical details without secrets after disclosure", () => {
    render(<PrivacyReceipt data={baseReceipt} />);

    const disclosure = screen.getByText("Privacy receipt").closest("details");
    expect(disclosure).not.toBeNull();
    disclosure!.open = true;

    expect(screen.getByText("AES-256-GCM, envelope v2")).toBeInTheDocument();
    expect(screen.getByText("PBKDF2-HMAC-SHA-256 (600,000 iterations)")).toBeInTheDocument();
    expect(screen.getByText("Link + password")).toBeInTheDocument();
    expect(screen.getByText("None")).toBeInTheDocument();
    expect(screen.getByText("Up to 3 releases")).toBeInTheDocument();
    expect(screen.getByText("ABCDEFGHIJKLMNOP…")).toBeInTheDocument();
    expect(
      screen.getByText(/cannot erase copies a recipient has already saved/i)
    ).toBeInTheDocument();
  });

  it("describes unlimited, single-release, scheduled, and attachment variants honestly", () => {
    render(
      <PrivacyReceipt
        data={{
          ...baseReceipt,
          maxReveals: null,
          hasFile: true,
          availableAt: "2026-08-30T09:00:00Z",
          kdf: "none",
        }}
      />
    );
    const disclosure = screen.getByText("Privacy receipt").closest("details");
    disclosure!.open = true;

    expect(screen.getByText("Unlimited ciphertext releases")).toBeInTheDocument();
    expect(screen.getByText("One encrypted file (name and type encrypted too)")).toBeInTheDocument();
    expect(screen.getByText("None required for this share")).toBeInTheDocument();
    expect(screen.getAllByText(/Copies already saved cannot be erased|cannot erase copies/iu).length).toBeGreaterThan(0);
  });

  it("renders the expanded Day-6 fields and offers a receipt download", () => {
    render(
      <PrivacyReceipt
        data={{
          ...baseReceipt,
          contentType: "Code (typescript)",
          fileCount: 2,
          discussionEnabled: true,
          revealWindowSeconds: 300,
        }}
      />
    );
    const disclosure = screen.getByText("Privacy receipt").closest("details");
    disclosure!.open = true;

    expect(screen.getByText("Code (typescript)")).toBeInTheDocument();
    expect(screen.getByText(/^2 encrypted files/u)).toBeInTheDocument();
    expect(
      screen.getByText("Enabled — revealed recipients can post encrypted replies")
    ).toBeInTheDocument();
    expect(screen.getByText("5 minutes from the first opening")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download receipt \(\.txt\)/iu })
    ).toBeInTheDocument();
  });
});
