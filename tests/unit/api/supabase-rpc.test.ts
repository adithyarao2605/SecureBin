import { afterEach, describe, expect, it, vi } from "vitest";

import { createRpcClient } from "../../../lib/server/supabase-rpc";

afterEach(() => {
  vi.unstubAllGlobals();
});

function response(): Response {
  return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("Supabase RPC authentication", () => {
  it("sends an opaque secret key only as an API key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    const client = createRpcClient({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "sb_secret_server_key",
      rateLimitHmacKey: "rate-limit-key",
    });
    await client.call("get_share_status", { p_public_id: "public-id" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({
      apikey: "sb_secret_server_key",
      "Content-Type": "application/json",
    });
  });

  it("keeps Bearer authentication for legacy service-role JWTs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response());
    vi.stubGlobal("fetch", fetchMock);

    const client = createRpcClient({
      supabaseUrl: "https://example.supabase.co",
      serviceRoleKey: "eyJlegacy-service-role-jwt",
      rateLimitHmacKey: "rate-limit-key",
    });
    await client.call("get_share_status", { p_public_id: "public-id" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({
      apikey: "eyJlegacy-service-role-jwt",
      Authorization: "Bearer eyJlegacy-service-role-jwt",
      "Content-Type": "application/json",
    });
  });
});
