import { Logger } from "./logger";

const API_BASE_URL = process.env.JAMBALT_API_URL;
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
  options?: Record<string, any>,
): Promise<{ data: JambaltApiResponse; response: Response }> {
  const apiUrl = API_BASE_URL;
  const requestBody = { url, ...options };
  let response: Response;
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // If API_BASE_KEY env exists, then include it:
  if (API_BASE_KEY) {
    headers["Authorization"] = `Api-Key ${API_BASE_KEY}`;
  }

  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });
    
    const data: JambaltApiResponse = await response.json();
    
    if (!response.ok) {
      Logger.error(
        `Jambalt API request failed with status ${response.status}: ${response.statusText}`
      );
      
      if (!API_BASE_KEY) {
        Logger.warn("No API key provided. Proceeding without authentication.");
      }

      // Return the data even if there's an error (it may contain useful error info)
      return { data, response };
    }

    return { data, response };
  } catch (error) {
    Logger.error("Error communicating with Jambalt API:", error);
    
    throw error; // Rethrow the error after logging it
  }
}


