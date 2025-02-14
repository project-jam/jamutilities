import { Logger } from "./logger";

// Function to get a summary from Wikipedia
export async function getWikipediaSummary(topic: string): Promise<string> {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch summary for ${topic}`);
    }

    const data = await response.json();

    if (!data.extract) {
      throw new Error(`No summary available for ${topic}`);
    }

    return data.extract;
  } catch (error) {
    Logger.error(`Failed to fetch Wikipedia summary for ${topic}:`, error);
    throw error;
  }
}

