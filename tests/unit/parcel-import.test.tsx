import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ParcelImport } from "../../app/components/parcel-import";
import { MAX_PARCEL_BYTES } from "../../lib/shares/parcel";

describe("ParcelImport", () => {
  it.each(["input", "drop"] as const)("rejects an oversized %s file from File.size before reading its bytes", (source) => {
    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    const file = {
      name: "oversized.securebin",
      size: MAX_PARCEL_BYTES + 1,
      arrayBuffer,
    } as unknown as File;

    render(<ParcelImport />);
    if (source === "input") {
      fireEvent.change(screen.getByLabelText("Parcel file"), { target: { files: [file] } });
    } else {
      fireEvent.drop(screen.getByRole("button", { name: "Choose or drop a .securebin parcel" }), {
        dataTransfer: { files: [file] },
      });
    }

    expect(screen.getByRole("alert")).toHaveTextContent("This parcel is too large");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
