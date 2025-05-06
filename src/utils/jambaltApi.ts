// utils/jambaltApi.ts
import { Logger } from "./logger";

const API_BASE_URL = process.env.JAMBALT_API_URL!;
const API_BASE_KEY = process.env.JAMBALT_API_KEY;

export interface JambaltApiResponse {
  status: "redirect" | "tunnel" | "picker" | "error";
  url?: string;
  filename?: string;
  picker?: any[];
  error?: {
    code?: string;
    context?: any;
  };
}

export async function callJambaltApi(
  url: string,
  options: Record<string, any> = {}
): Promise<{ data: JambaltApiResponse; response: Response }> {
  // If the user asked for an audio format but didn’t set downloadMode,
  // force audio‐only mode so you get an MP3/OGG/etc.
  if (options.audioFormat && !options.downloadMode) {
    options.downloadMode = "audio";
  }

  const requestBody = { url, ...options };
  Logger.info("📦 Jambalt Request Body:", JSON.stringify(requestBody, null, 2));

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "Content-Type": "application/json",
  };
  if (API_BASE_KEY) {
    headers["Authorization"] = `Api-Key ${API_BASE_KEY}`;
  }

  const response = await fetch(API_BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  const data: JambaltApiResponse = await response.json();
  if (!response.ok) {
    Logger.error(
      `Jambalt API request failed (${response.status}):`,
      data.error || data
    );
  }

  return { data, response };
}

