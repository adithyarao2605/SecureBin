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

  it("renders one editable IDE panel with live syntax highlighting", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    const languagePicker = screen.getByRole("combobox", { name: "Programming language" });
    expect(languagePicker).toHaveValue("plaintext");
    fireEvent.focus(languagePicker);
    fireEvent.click(screen.getByRole("option", { name: "typescript" }));

    const textarea = screen.getByLabelText("Code content");
    fireEvent.change(textarea, {
      target: { value: "const answer: number = 42;" },
    });

    expect(languagePicker).toHaveValue("typescript");
    const editor = screen.getByRole("region", { name: "Code editor in typescript" });
    expect(editor).toBeInTheDocument();
    expect(editor.querySelector(".code-editor-highlight .hljs-keyword")).toBeInTheDocument();
    expect(editor.querySelector(".code-editor-highlight .hljs-number")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Split" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("detects the first pasted snippet once without changing later selections", () => {
    render(<Composer />);

    fireEvent.click(screen.getByRole("tab", { name: "Code" }));
    const textarea = screen.getByLabelText("Code content");
    const languagePicker = screen.getByRole("combobox", { name: "Programming language" });
    expect(languagePicker).toHaveValue("plaintext");

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => "const answer = 42;" },
    });
    expect(languagePicker).toHaveValue("javascript");

    fireEvent.paste(textarea, {
      clipboardData: { getData: () => "SELECT * FROM users;" },
    });
    expect(languagePicker).toHaveValue("javascript");
  });
});
