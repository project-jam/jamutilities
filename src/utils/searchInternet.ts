import { Logger } from './logger';

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Performs a DuckDuckGo HTML search and returns parsed results.
 * Includes a Windows Chrome User-Agent for better compatibility.
 */
export async function searchDuckDuckGo(
  query: string,
  maxResults: number = 5
): Promise<SearchResult[]> {
  try {
    // Use a Windows Chrome User-Agent to mimic a standard browser
    const userAgent =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/115.0.0.0 Safari/537.36';

    const response = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent
      },
      body: `q=${encodeURIComponent(query)}`
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo search failed with status ${response.status}`);
    }

    const html = await response.text();
    const results: SearchResult[] = [];
    const regex = /<h2 class="result__title">([\s\S]*?)<\/h2>[\s\S]*?<div class="result__extras__url">([\s\S]*?)<\/div>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    let match: RegExpExecArray | null;
    while (results.length < maxResults && (match = regex.exec(html))) {
      const [_, titleBlock, urlBlock, descBlock] = match;

      const titleMatch = titleBlock.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const urlMatch = urlBlock.match(/<a[^>]+href="([^"]+)"/);
      if (!titleMatch || !urlMatch) continue;

      const stripTags = (str: string) =>
        str.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

      results.push({
        title: stripTags(titleMatch[2]),
        url: urlMatch[1],
        description: stripTags(descBlock)
      });
    }

    Logger.info(`DuckDuckGo search for "${query}" returned ${results.length} result(s)`);
    return results;
  } catch (error) {
    Logger.error(`DuckDuckGo search failed for "${query}":`, error);
    throw error;
  }
}

