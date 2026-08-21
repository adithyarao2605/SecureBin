import { readServerConfig, type ServerConfig } from "./config";

export class RpcRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly errorDetails: string | null;

  constructor(status: number, code: string | null, errorDetails: string | null = null) {
    super("SecureBin server dependency request failed");
    this.name = "RpcRequestError";
    this.status = status;
    this.code = code;
    this.errorDetails = errorDetails;
  }
}

export interface RpcClient {
  call(functionName: string, args: Record<string, unknown>): Promise<unknown>;
}

export function createRpcClient(config: ServerConfig = readServerConfig()): RpcClient {
  const endpoint = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/`;
  return {
    async call(functionName: string, args: Record<string, unknown>): Promise<unknown> {
      let response: Response;
      try {
        const headers: Record<string, string> = {
          apikey: config.serviceRoleKey,
          "Content-Type": "application/json",
        };
        // New sb_secret_* API keys are opaque, not JWTs. Supabase authenticates
        // them through `apikey`; only legacy service_role JWTs belong in the
        // Bearer header.
        if (!config.serviceRoleKey.startsWith("sb_secret_")) {
          headers.Authorization = `Bearer ${config.serviceRoleKey}`;
        }
        response = await fetch(`${endpoint}${functionName}`, {
          method: "POST",
          headers,
          body: JSON.stringify(args),
          cache: "no-store",
        });
      } catch {
        throw new RpcRequestError(503, null, null);
      }
      if (!response.ok) {
        let code: string | null = null;
        let details: string | null = null;
        try {
          const payload: unknown = await response.json();
          if (typeof payload === "object" && payload !== null) {
            if ("code" in payload && typeof payload.code === "string") code = payload.code;
            if ("message" in payload && typeof payload.message === "string") details = payload.message;
          }
        } catch {
          code = null;
          details = null;
        }
        throw new RpcRequestError(response.status, code, details);
      }
      try {
        const payload: unknown = await response.json();
        return payload;
      } catch {
        throw new RpcRequestError(502, null);
      }
    },
  };
}
