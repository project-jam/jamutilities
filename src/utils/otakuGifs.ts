import { Logger } from "./logger";

export type GifType =
  | "kiss"
  | "hug"
  | "airkiss"
  | "wave"
  | "tickle"
  | "evillaugh"
  | "pat"
  | "poke"
  | "slap"
  | "blush";

// Function to get a GIF from the API
export async function getGif(type: GifType): Promise<string> {
  try {
    const response = await fetch(
      `https://api.otakugifs.xyz/gif?reaction=${type}`,
    );
    const data = await response.json();

    if (!data.url) {
      throw new Error(`Failed to get ${type} GIF URL`);
    }

    return data.url;
  } catch (error) {
    Logger.error(`Failed to fetch ${type} GIF:`, error);
    throw error;
  }
}

// Generic function to get random messages
export function getRandomMessage<
  T extends (user: string, target: string) => string,
>(messages: T[], user: string, target: string): string {
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex](user, target);
}
