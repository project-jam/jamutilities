import { Logger } from "./logger";

const API_BASE_URL = process.env.JAMBALT_API_URL;

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
  options?: Record<string, any>,
): Promise<{ data: JambaltApiResponse; response: Response }> {
  const apiUrl = API_BASE_URL;
  const requestBody = { url, ...options };

  let response: Response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      Logger.error(
        `Jambalt API request failed with status ${response.status}: ${response.statusText}`,
      );
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    const data: JambaltApiResponse = await response.json();
    return { data, response };
  } catch (error) {
    Logger.error("Error communicating with Jambalt API:", error);
    throw error;
  }
}
