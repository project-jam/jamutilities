// src/utils/searchInternet.ts
import fetch from "node-fetch";
import { Logger } from "./logger";

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
 * Fetch search results from JamAPI and log the query + full results
 */
export async function searchInternet(
  query: string,
  lang = "en",
  num = 10
): Promise<SearchResponse> {
  const apiUrl = `https://api.project-jam.is-a.dev/api/v0/data/text-search?q=${encodeURIComponent(
    query
  )}&lang=${encodeURIComponent(lang)}&num=${num}`;

  Logger.debug(`🔍 [searchInternet] querying JamAPI for: "${query}" (lang=${lang}, num=${num})`);

  const res = await fetch(apiUrl, {
    headers: { "Accept-Language": lang },
  });

  if (!res.ok) {
    Logger.error(`❌ [searchInternet] API responded with status ${res.status}`);
    throw new Error(`API responded with ${res.status}`);
  }

  const data = (await res.json()) as SearchResponse;

  Logger.info(`✅ [searchInternet] results for "${query}" (count=${data.result})`);
  Logger.debug(JSON.stringify(data, null, 2)); // full JSON logged only in DEBUG

  return data;
}

