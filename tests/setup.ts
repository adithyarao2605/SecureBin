import "@testing-library/jest-dom/vitest";

// jsdom's File lacks arrayBuffer(); bridge it through FileReader, which
// operates on jsdom's own Blob implementation (a WHATWG Response would call
// blob.stream() and fail on CI's Node).
if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer !== "function") {
  File.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
      reader.readAsArrayBuffer(this);
    });
  };
}
