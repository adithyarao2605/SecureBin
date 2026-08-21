import { describe, expect, it, vi } from "vitest";

import {
  createPostCleanupHandler,
  type CleanupRouteDependencies,
} from "@/lib/server/cleanup-routes";

function cleanupDependencies(
  serviceOverrides: Partial<CleanupRouteDependencies["cleanupService"]> = {},
  cronSecret = "super-secret-cron-token"
): CleanupRouteDependencies {
  return {
    cronSecret,
    cleanupService: {
      runCleanup: vi.fn(async () => ({
        deletedShares: 2,
        deletedUploads: 1,
        deletedUploadRotations: 0,
        deletedLeases: 4,
        deletedBuckets: 3,
      })),
      ...serviceOverrides,
    },
  };
}

describe("POST /api/internal/cleanup route handler", () => {
  it("rejects unauthenticated requests with uniform 404 unavailable", async () => {
    const deps = cleanupDependencies();
    const handler = createPostCleanupHandler(deps);
    const response = await handler(new Request("http://localhost/api/internal/cleanup", {
      method: "POST",
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "unavailable" });
    expect(deps.cleanupService.runCleanup).not.toHaveBeenCalled();
  });

  it("rejects requests with wrong cron secret with uniform 404 unavailable", async () => {
    const deps = cleanupDependencies();
    const handler = createPostCleanupHandler(deps);
    const response = await handler(new Request("http://localhost/api/internal/cleanup", {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
      },
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "unavailable" });
    expect(deps.cleanupService.runCleanup).not.toHaveBeenCalled();
  });

  it("accepts valid Bearer token and returns cleanup aggregates", async () => {
    const deps = cleanupDependencies();
    const handler = createPostCleanupHandler(deps);
    const response = await handler(new Request("http://localhost/api/internal/cleanup", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-cron-token",
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedShares: 2,
      deletedUploads: 1,
      deletedUploadRotations: 0,
      deletedLeases: 4,
      deletedBuckets: 3,
    });
    expect(deps.cleanupService.runCleanup).toHaveBeenCalledOnce();
  });

  it("accepts valid x-cron-secret header and returns cleanup aggregates", async () => {
    const deps = cleanupDependencies();
    const handler = createPostCleanupHandler(deps);
    const response = await handler(new Request("http://localhost/api/internal/cleanup", {
      method: "POST",
      headers: {
        "x-cron-secret": "super-secret-cron-token",
      },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedShares: 2,
      deletedUploads: 1,
      deletedUploadRotations: 0,
      deletedLeases: 4,
      deletedBuckets: 3,
    });
  });

  it("returns 500 when cleanup execution fails", async () => {
    const deps = cleanupDependencies({
      runCleanup: vi.fn().mockRejectedValue(new Error("Database connection lost")),
    });
    const handler = createPostCleanupHandler(deps);
    const response = await handler(new Request("http://localhost/api/internal/cleanup", {
      method: "POST",
      headers: {
        authorization: "Bearer super-secret-cron-token",
      },
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "server_error" });
  });
});
