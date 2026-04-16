import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ImageUploader from "./ImageUploader";

describe("ImageUploader", () => {
  it("renders upload area with instructions", () => {
    render(<ImageUploader onFilesAdded={vi.fn()} currentCount={0} />);

    expect(
      screen.getByText("ここに画像をドラッグ&ドロップ"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("またはクリックしてファイルを選択"),
    ).toBeInTheDocument();
  });

  it("contains a hidden file input", () => {
    render(<ImageUploader onFilesAdded={vi.fn()} currentCount={0} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(input).toBeDefined();
    expect(input.multiple).toBe(true);
    expect(input.accept).toBe(".jpg,.jpeg,.png");
  });

  it("calls onFilesAdded with valid files on change", () => {
    const onFilesAdded = vi.fn();
    render(<ImageUploader onFilesAdded={onFilesAdded} currentCount={0} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["imagedata"], "photo.jpg", { type: "image/jpeg" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFilesAdded).toHaveBeenCalledWith([file]);
  });

  it("rejects files with invalid extensions", () => {
    const onFilesAdded = vi.fn();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ImageUploader onFilesAdded={onFilesAdded} currentCount={0} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File(["data"], "test.gif", { type: "image/gif" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(alertSpy).toHaveBeenCalled();
    expect(onFilesAdded).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("prevents adding over max page count", () => {
    const onFilesAdded = vi.fn();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(<ImageUploader onFilesAdded={onFilesAdded} currentCount={49} />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const files = [
      new File(["a"], "a.jpg", { type: "image/jpeg" }),
      new File(["b"], "b.jpg", { type: "image/jpeg" }),
    ];

    fireEvent.change(input, { target: { files } });

    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining("50"));
    expect(onFilesAdded).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
