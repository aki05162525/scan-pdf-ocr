import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LanguageSelect from "./LanguageSelect";

describe("LanguageSelect", () => {
  it("renders with jpn selected by default", () => {
    render(<LanguageSelect value="jpn" onChange={vi.fn()} />);

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("jpn");
  });

  it("displays both language options", () => {
    render(<LanguageSelect value="jpn" onChange={vi.fn()} />);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("日本語");
    expect(options[1]).toHaveTextContent("日本語 + 英語");
  });

  it("calls onChange when selection changes", () => {
    const onChange = vi.fn();
    render(<LanguageSelect value="jpn" onChange={onChange} />);

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "jpn+eng" },
    });

    expect(onChange).toHaveBeenCalledWith("jpn+eng");
  });

  it("renders label text", () => {
    render(<LanguageSelect value="jpn" onChange={vi.fn()} />);
    expect(screen.getByText("OCR言語")).toBeInTheDocument();
  });
});
