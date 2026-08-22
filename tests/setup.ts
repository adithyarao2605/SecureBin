import "@testing-library/jest-dom/vitest";

// jsdom's File lacks arrayBuffer(); bridge it through the WHATWG Response
// constructor available in the Node runtime so staged upload flows can run.
if (typeof File !== "undefined" && typeof File.prototype.arrayBuffer !== "function") {
  File.prototype.arrayBuffer = async function (): Promise<ArrayBuffer> {
    return new Response(this as unknown as Blob).arrayBuffer();
  };
}
