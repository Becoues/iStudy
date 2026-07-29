import OpenAI from "openai";

export const PROVIDER_BASE_URLS: Record<string, string> = {
  CometAPI: "https://api.cometapi.com/v1",
};

export const DEFAULT_PROVIDER = "CometAPI";
export const DEFAULT_MODEL = "gpt-5.4";
export const DEFAULT_IMAGE_MODEL = "gpt-image-2";

export function baseURLFor(provider?: string | null): string {
  return (
    PROVIDER_BASE_URLS[provider || ""] || PROVIDER_BASE_URLS[DEFAULT_PROVIDER]
  );
}

export function createLLMClient(
  settings?: { apiKey?: string | null; provider?: string | null } | null,
): OpenAI {
  return new OpenAI({
    apiKey: settings?.apiKey || process.env.COMETAPI_API_KEY || "",
    baseURL: baseURLFor(settings?.provider),
  });
}
