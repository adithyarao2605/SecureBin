import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Composer } from "../../app/components/composer";

describe("composer markdown edit / split / preview", () => {
  it("shows only the textarea in edit view by default", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Markdown" }));

    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
    expect(screen.queryByLabelText(/Markdown authoring preview/u)).not.toBeInTheDocument();
  });

  it("renders textarea and live preview side-by-side in split view", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Markdown" }));
    const textarea = screen.getByLabelText("Markdown content") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "# Split heading" } });
    fireEvent.click(screen.getByRole("tab", { name: "Split" }));

    const wrapper = textarea.closest(".md-split");
    expect(wrapper).not.toBeNull();
    const preview = screen.getByLabelText("Markdown authoring preview");
    expect(preview).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Split heading" })
    ).toBeInTheDocument();
  });

  it("hides the textarea and shows only the preview in preview view", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Markdown" }));
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.queryByLabelText("Markdown content")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Markdown authoring preview")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Edit" }));
    expect(screen.getByLabelText("Markdown content")).toBeInTheDocument();
  });

  it("supports roving keyboard focus across Markdown view tabs", () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole("tab", { name: "Markdown" }));
    const edit = screen.getByRole("tab", { name: "Edit" });
    edit.focus();
    fireEvent.keyDown(edit, { key: "ArrowRight" });
    const split = screen.getByRole("tab", { name: "Split" });
    expect(split).toHaveFocus();
    expect(split).toHaveAttribute("aria-selected", "true");
  });

  it("renders a language-aware Code preview without replacing the editor", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    fireEvent.change(screen.getByLabelText("Code content"), {
      target: { value: "const answer: number = 42;" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Preview" }));

    expect(screen.queryByLabelText("Code content")).not.toBeInTheDocument();
    const preview = screen.getByLabelText("Code authoring preview in typescript");
    expect(preview).toBeInTheDocument();
    expect(preview.querySelector(".hljs-keyword")).toBeInTheDocument();
    expect(preview.querySelector(".hljs-number")).toBeInTheDocument();
  });

  it("stacks the Code editor and preview in split view", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    const textarea = screen.getByLabelText("Code content");
    fireEvent.change(textarea, { target: { value: "print('hello')" } });
    fireEvent.click(screen.getByRole("tab", { name: "Split" }));

    expect(textarea.closest(".code-split")).not.toBeNull();
    expect(screen.getByLabelText("Code authoring preview in typescript")).toBeInTheDocument();
  });
});
