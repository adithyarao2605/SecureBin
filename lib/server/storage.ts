import { createClient } from "@supabase/supabase-js";
import { readServerConfig, type ServerConfig } from "./config";

export interface SecureStorage {
  createSignedUpload(path: string): Promise<{ url: string; token?: string }>;
  createSignedDownload(path: string, expiresInSeconds: number): Promise<string>;
  inspectSize(path: string): Promise<number | null>;
  remove(path: string): Promise<"deleted" | "missing">;
}

export function createSecureStorage(
  config: Pick<ServerConfig, "supabaseUrl" | "serviceRoleKey"> & Partial<ServerConfig> = readServerConfig()
): SecureStorage {
  const client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const bucket = "securebin-files";

  return {
    async createSignedUpload(path: string) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUploadUrl(path, { upsert: false });
      if (error || !data) {
        throw new Error("Failed to generate signed upload URL");
      }
      return {
        url: data.signedUrl,
        token: data.token,
      };
    },

    async createSignedDownload(path: string, expiresInSeconds: number) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data) {
        throw new Error("Failed to generate signed download URL");
      }
      return data.signedUrl;
    },

    async inspectSize(path: string) {
      const slashIndex = path.lastIndexOf("/");
      const folder = slashIndex >= 0 ? path.substring(0, slashIndex) : "";
      const filename = slashIndex >= 0 ? path.substring(slashIndex + 1) : path;
      const { data, error } = await client.storage
        .from(bucket)
        .list(folder, { search: filename, limit: 1 });
      if (error || !data || data.length === 0) return null;
      const match = data.find((item) => item.name === filename);
      if (!match || !match.metadata || typeof match.metadata.size !== "number") return null;
      return match.metadata.size;
    },

    async remove(path: string) {
      const { data, error } = await client.storage
        .from(bucket)
        .remove([path]);
      if (error) {
        throw new Error("Failed to remove storage object");
      }
      return data && data.length > 0 ? "deleted" : "missing";
    },
  };
}
