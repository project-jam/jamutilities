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
 * Fetch search results from JamAPI
 */
export async function searchInternet(
  query: string,
  lang = "en",
  num = 10,
): Promise<SearchResponse> {
  const apiUrl = `https://api.project-jam.is-a.dev/api/v0/data/text-search?q=${encodeURIComponent(
    query,
  )}&lang=${encodeURIComponent(lang)}&num=${num}`;

  const res = await fetch(apiUrl, {
    headers: { "Accept-Language": lang },
  });
  if (!res.ok) throw new Error(`API responded with ${res.status}`);
  return res.json() as Promise<SearchResponse>;
}

