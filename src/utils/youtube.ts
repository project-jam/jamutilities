////////////////////////////////////////////////////////////////////
///// WARNING: This file is not being used in the project.     /////
///// If you want to use it, you need to import it in index.ts /////
///// As this file is not being used, it is not being tested.  /////
///// It may or may not work as expected.                      /////
///// And it may crash the bot.                                /////
///// You have been warned.                                    /////
////////////////////////////////////////////////////////////////////

import play from "play-dl";

export async function getVideoURL(query: string): Promise<string | null> {
  // Check if the query is already a valid YouTube URL.
  const urlRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = query.match(urlRegex);
  if (match && match[1]) {
    return `https://www.youtube.com/watch?v=${match[1]}`;
  }

  // Otherwise, use play-dl's search to find a video.
  try {
    const results = await play.search(query, { source: { youtube: "video" } });
    if (results && results.length > 0) {
      // If the search result contains a URL, return it.
      if (results[0].url) {
        return results[0].url;
      }
      // Fallback: construct the URL using the video id.
      return `https://www.youtube.com/watch?v=${results[0].id}`;
    }
    return null;
  } catch (error) {
    throw new Error("Error fetching YouTube video info: " + error.message);
  }
}
