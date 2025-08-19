import fetch from "node-fetch";

export interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export interface SearchResponse {
  query: string;
  suggestion: string | null;
  result: number;
  "result-contents": SearchResult[];
  lang: string;
  num: number;
}

/**
 * Fetch search results from JamAPI and log the query + response
 */
export async function searchInternet(
  query: string,
  lang = "en",
  num = 10,
): Promise<SearchResponse> {
  const apiUrl = `https://api.project-jam.is-a.dev/api/v0/data/text-search?q=${encodeURIComponent(
    query,
  )}&lang=${encodeURIComponent(lang)}&num=${num}`;

  console.log(`🔍 searching JamAPI for: "${query}" (lang=${lang}, num=${num})`);

  const res = await fetch(apiUrl, {
    headers: { "Accept-Language": lang },
  });

  if (!res.ok) {
    console.error(`❌ search failed with status ${res.status}`);
    throw new Error(`API responded with ${res.status}`);
  }

  const data = (await res.json()) as SearchResponse;

  console.log(`✅ search results for "${query}":`, JSON.stringify(data, null, 2));

  return data;
}

