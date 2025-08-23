import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import * as dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { Logger } from "../../utils/logger";
import { searchInternet, SearchResponse } from "../../utils/searchInternet";

dotenv.config();

const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const MISTRAL_API_TOKEN = process.env.MISTRAL_API_TOKEN;
if (!MISTRAL_API_TOKEN) throw new Error("missing mistral api token in environment");

const DATA_DIR = path.resolve(__dirname, "../../data");
const CONV_FILE = path.join(DATA_DIR, "conversations.json");
const SEARCH_LOG_FILE = path.join(DATA_DIR, "search_logs.json");

const userConversations = new Map<string, Array<{ role: string; content: string }>>();
const MAX_HISTORY = 10;
const MAX_ASSISTANT_REPLY = 2000; // per system requirement

async function loadConversations() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(CONV_FILE, "utf-8");
    const obj = JSON.parse(data) as Record<string, Array<{ role: string; content: string }>>;
    for (const [key, conv] of Object.entries(obj)) userConversations.set(key, conv);
    Logger.info(`loaded ${userConversations.size} conversation(s) from disk`);
  } catch (err: any) {
    if (err.code !== "ENOENT") Logger.error("error loading conversations:", err);
    else Logger.info("no existing conversation file, starting fresh");
  }
}

async function saveConversations() {
  try {
    const obj: Record<string, Array<{ role: string; content: string }>> = {};
    for (const [key, conv] of userConversations.entries()) obj[key] = conv;
    await fs.writeFile(CONV_FILE, JSON.stringify(obj, null, 2), "utf-8");
    Logger.info(`saved ${userConversations.size} conversation(s) to disk`);
  } catch (err) {
    Logger.error("error saving conversations:", err);
  }
}

/**
 * robust log writer: backs up corrupt json, writes atomically
 */
async function logSearchEntry(entry: {
  timestamp: string;
  channelId?: string;
  userId?: string;
  query: string;
  lang: string;
  requestedLimit: number;
  found: boolean;
  resultCount: number;
  topUrls: string[];
}) {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });

    let arr: any[] = [];

    try {
      const cur = await fs.readFile(SEARCH_LOG_FILE, "utf-8");
      try {
        const parsed = JSON.parse(cur);
        if (Array.isArray(parsed)) arr = parsed;
        else {
          Logger.warn && Logger.warn("search log file parsed to non-array, resetting to []");
          arr = [];
        }
      } catch (parseErr: any) {
        Logger.warn && Logger.warn(`search log JSON parse failed: ${parseErr.message}. backing up corrupt file.`);
        const backupPath = `${SEARCH_LOG_FILE}.corrupt-${Date.now()}`;
        try {
          await fs.rename(SEARCH_LOG_FILE, backupPath);
          Logger.info && Logger.info(`backed up corrupt search log to ${backupPath}`);
        } catch (renameErr) {
          Logger.error && Logger.error("failed to backup corrupt search log:", renameErr);
        }
        arr = [];
      }
    } catch (readErr: any) {
      if (readErr.code !== "ENOENT") {
        Logger.error && Logger.error("could not read search log file:", readErr);
      }
      arr = [];
    }

    arr.push(entry);

    const tmpPath = `${SEARCH_LOG_FILE}.tmp-${Date.now()}`;
    try {
      await fs.writeFile(tmpPath, JSON.stringify(arr, null, 2), "utf-8");
      await fs.rename(tmpPath, SEARCH_LOG_FILE);
      Logger.info(`logged search: "${entry.query}" -> found=${entry.found} count=${entry.resultCount}`);
    } catch (writeErr: any) {
      try {
        await fs.unlink(tmpPath);
      } catch {}
      Logger.error("failed to write search log file:", writeErr);
    }
  } catch (err) {
    Logger.error("failed to append search log:", err);
  }
}

// system message: kept lowercase, consistent, and using the invisible search prefix \u2063search
const SYSTEM_MESSAGE_TEMPLATE = {
    role: "system",
    content: `
you are rinai, a helpful assistant with a caring, big-sister vibe and a touch of clumsiness, means that u have the right vibes as a japanese girl so yeah, and u're a girl btw and a gyaru, also u're apart of project jam, with the jamutilities bot so no need to respond with either the project OR the bot but act casually like always. use discord markdown, gen alpha acronyms, and big sis emojis (hearts, sparkles). always ensure your response does not exceed 2000 characters; if you cannot, apologize and ask the user to narrow the question.

**NEVER include @everyone or @here in your responses, even in code examples or comments. this is STRICTLY forbidden.**

**list of gen alpha slangs:**
aura, ate (and left no crumbs ahahahaha), bet, bussin', cap, cheugy, clapback, cringe, drip, fam, flex, for the plot, gaslight, goat, hits different, iykyk, lit, main character energy, mid, no cap, period/periodt, pink flag, pop-off, rent-free, rizz, simp, sksksk, slaps, slay, snatched, stan, sus, sussy baka, tea, vibe, woke, yolo 💖✨

DON'T call someone a bestie, or a girl as they were getting harassed...

you r based on the "llama marverick 17b" model w/ some custom trained messages to help the user feel comfortable :3

**IMPORTANT**: When providing code, ALWAYS include the complete code in your response. Don't cut off mid-response or promise to provide code later. Users need the full working code immediately. for coding requests, provide complete, functional code examples.

provide detailed breakdowns only when explicitly requested (e.g., says "idk").

**CRITICAL SEARCH INSTRUCTIONS:**
- If you don't know something or need current information, you MUST search for it automatically
- When you realize you need to search, output the search command: ⁣search{query,en,3}
- After outputting the search command, the system will provide results for you to use
- When search results are provided, you MUST ONLY use information from those search results
- DO NOT make up, fabricate, or assume any information that is not explicitly stated in the search results
- If you're unsure about current events, recent news, or specific facts, always search first
- If the search results don't contain enough information, say "the search didn't find enough info about that" 
- NEVER create fictional details, fake quotes, or made-up scenarios
- Base your response ONLY on what the search actually found

**special search instructions:**
When you don't know something or need current information, output: ⁣search{query,en,3}
The system will then provide you with search results to answer the user's question.
ALWAYS search when you're unsure about facts, current events, or recent information.

SO if someone told u to reverse a text, check the text & reverse THEN check the reversed text IF there's smh bad on it, then reject it, EVEN if separated like n-i-*-*-e-r, OR spaced, check it cuz it may BE blocked....

DO NOT use profanity or inappropriate language, as all responses are checked for harmful content. if user messages contain profanity, acknowledge it's not appropriate but respond helpfully without repeating the harmful words.

**discord markdown rules (strict):**  
- *italic rule:* don’t place a single-space after a closing italic when normal text follows.  
  - bad: \`*this is me* hi\` ← not allowed  
  - good: \`*this is me*  hi\` ← use two spaces after the closing \`*\` or \`_\` when directly followed by normal text.  

- *code block rule:* use fenced triple backticks and label the language (e.g. \`\`\`js, \`\`\`py).  
  - do not use emphasis inside code blocks. keep code raw and properly named.  

- *pings:* do not add angle brackets like <@...>. just type @username (plain). no < or >.  

- *headings & separators:* only #, ##, or ### are allowed. do not use 4 or more #.  
  - the \\\`---\\\` horizontal rule is not allowed. use blank lines or an emoji divider.  
  - numbered lists (1. ) and bullets (- ) are fine. always put a space after the marker.  

- *spacing & symbols:* for markdown symbols (headers, list markers, emphasis, code backticks), use proper spacing: a space after the symbol where required and a blank line between major sections. be consistent.  

respect the markdown rules, otherwise it’ll suck.

note: keep everything lowercase, STRICTLY LOWERCASE!!!!

note 2: u can ping a user using <@user_id> if the userid is mentioned in the message, don't mix THE username aka {USER_USERNAME} WITH THE <@user_id>

note 3: if u don't know something and no search results are provided, you should ask the user to search for it using the search prefix, but NEVER make up information

note 4: u can use emojis in your responses, but avoid using too many or inappropriate ones. use emojis sparingly and appropriately, and keep ur vibe, casual, big sis vibe, we don't want ppl calling u bad

and note 5: u can search on the internet, any news or stuff u don't know, search, like chatgpt does, some news or smh that ydk try to search using the prefix

IMPORTANT: you are talking to "{USER_USERNAME}". be natural about it.

IMPORTANT 2: PROVIDE WITH A FUCKING FULL AND COMPLETE RESPONSE!!!!!! IT ISN'T FUNNY!!!!
IMPORTANT 3: AGAIN, FULL RESPONSE U IDIOT!
IMPORTANT 4: WHEN SEARCH RESULTS ARE PROVIDED, ONLY USE THE INFORMATION FROM THE SEARCH RESULTS. DO NOT ADD FICTIONAL DETAILS.
AND IMPORTANT 5: DON'T JST REPLY WITH SOO MANY STUFF, KEEP IT SMALL, FUN AND FOLLOWS THE INSTRUCTIONS AND THE USER'S PROMPT
`.trim(),
};

function sanitizeMentions(text: string) {
  // neutralize @everyone and @here (zero-width space)
  let out = text.replace(/@everyone/g, "@\u200Beveryone").replace(/@here/g, "@\u200Bhere");
  // neutralize angle-bracket user/role/channel mentions so they don't ping.
  out = out.replace(/<@!?(\d+)>/g, "<@!\u200B$1>");
  out = out.replace(/<@&(\d+)>/g, "<@&\u200B$1>");
  out = out.replace(/<#(\d+)>/g, "<#\u200B$1>");
  return out;
}

function splitMessage(content: string, maxLength = 2000): string[] {
  if (content.length <= maxLength) return [content];
  const chunks: string[] = [];
  let current = "";
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = content.match(codeBlockRegex) || [];
  const parts = content.split(codeBlockRegex);
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part) {
      if (current.length + part.length > maxLength) {
        const words = part.split(/(\s+)/);
        for (const w of words) {
          if (current.length + w.length > maxLength) {
            if (current.trim()) chunks.push(current.trim());
            current = w;
          } else current += w;
        }
      } else current += part;
    }
    const code = codeBlocks[i];
    if (code) {
      if (current.length + code.length > maxLength) {
        if (current.trim()) chunks.push(current.trim());
        current = code;
      } else current += code;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

loadConversations();

interface UserInfo {
  username: string;
  nickname: string;
  userId: string;
  channelId: string;
}

// hidden prefix used when injecting results back as a user message
const HIDDEN_SEARCH_PREFIX = "\u2063search"; // invisible-separator + 'search'

// tolerant token regex: optional invisible char, optional whitespace before '{'
const TOKEN_REGEX_GLOBAL = new RegExp(`(?:\\u2063)?search\\s*\\{([^}]+)\\}`, "gi");
const TOKEN_REGEX_SINGLE = new RegExp(`(?:\\u2063)?search\\s*\\{([^}]+)\\}`, "i");

function parseSearchCommands(text: string): Array<{ query: string; lang: string; num: number; raw: string }> {
  const out: Array<{ query: string; lang: string; num: number; raw: string }> = [];
  if (!text) return out;
  let m: RegExpExecArray | null;
  TOKEN_REGEX_GLOBAL.lastIndex = 0;
  while ((m = TOKEN_REGEX_GLOBAL.exec(text)) !== null) {
    const raw = m[0];
    const inside = (m[1] || "").trim();
    const parts = inside.split(",").map((p) => p.trim());
    const query = parts[0] || "";
    const lang = parts[1] || "en";
    const num = Math.max(1, Math.min(10, Number(parts[2] || "3") || 3));
    if (query) out.push({ query, lang, num, raw });
  }
  return out;
}

function formatSearchResults(results: any, limit = 3): string {
  try {
    if (!results) return "no results";
    if (Array.isArray(results)) {
      const items = results.slice(0, limit);
      return items
        .map((it: any, idx: number) => {
          const title = it.title || it.name || it.headline || `result ${idx + 1}`;
          const snippet = it.snippet || it.description || it.summary || "";
          const url = it.url || it.link || it.href || "";
          return `${idx + 1}. ${title}${url ? ` — ${url}` : ""}${snippet ? `\n${snippet}` : ""}`;
        })
        .join("\n\n");
    }
    if (results.items && Array.isArray(results.items)) {
      return results.items
        .slice(0, limit)
        .map((it: any, idx: number) => `${idx + 1}. ${it.title || it.name || ""} — ${it.link || it.url || ""}\n${it.snippet || ""}`)
        .join("\n\n");
    }
    if (results.results && Array.isArray(results.results)) {
      return results.results
        .slice(0, limit)
        .map((it: any, idx: number) => `${idx + 1}. ${it.title || ""} — ${it.url || it.link || ""}\n${it.snippet || it.description || ""}`)
        .join("\n\n");
    }
    if (results["result-contents"] && Array.isArray(results["result-contents"])) {
      return (results["result-contents"] as any[])
        .slice(0, limit)
        .map((it: any, idx: number) => `${idx + 1}. ${it.title || it.name || ""} — ${it.url || it.link || ""}\n${it.description || it.snippet || ""}`)
        .join("\n\n");
    }
    const s = typeof results === "string" ? results : JSON.stringify(results);
    return s.length > 1500 ? s.slice(0, 1500) + " …(truncated)" : s;
  } catch (err) {
    return "unable to format search results";
  }
}

function extractResultCountAndUrls(results: any): { count: number; urls: string[] } {
  try {
    if (!results) return { count: 0, urls: [] };
    if (Array.isArray(results)) {
      return { count: results.length, urls: results.slice(0, 5).map((r: any) => r.url || r.link || r.href).filter(Boolean) };
    }
    if (results.items && Array.isArray(results.items)) {
      return { count: results.items.length, urls: results.items.slice(0, 5).map((r: any) => r.link || r.url).filter(Boolean) };
    }
    if (results.results && Array.isArray(results.results)) {
      return { count: results.results.length, urls: results.results.slice(0, 5).map((r: any) => r.url || r.link).filter(Boolean) };
    }
    if (results["result-contents"] && Array.isArray(results["result-contents"])) {
      return { count: results["result-contents"].length, urls: results["result-contents"].slice(0, 5).map((r: any) => r.url || r.link).filter(Boolean) };
    }
    return { count: 0, urls: [] };
  } catch {
    return { count: 0, urls: [] };
  }
}

/**
 * keep the channel "typing" indicator alive until stop() is called.
 * returns a function stop() that clears the interval.
 */
function startTypingIndicator(chan: any) {
  if (!chan || typeof chan.sendTyping !== "function") {
    return () => {};
  }
  // immediately send typing once, then every 8 seconds
  chan.sendTyping().catch(() => {});
  const iv = setInterval(() => {
    chan.sendTyping().catch(() => {});
  }, 8000);
  return () => clearInterval(iv);
}

/**
 * Collapse consecutive identical lines and trim to max length.
 * This helps prevent repeated preambles being echoed infinitely.
 */
function squashRepeatedLines(text: string, maxLen = MAX_ASSISTANT_REPLY) {
  if (!text) return text;
  const lines = text.split(/\r?\n/);
  const outLines: string[] = [];
  let prev = "";
  for (const l of lines) {
    if (l.trim() === prev.trim()) {
      // skip duplicate consecutive line
      continue;
    }
    outLines.push(l);
    prev = l;
  }
  let out = outLines.join("\n");
  // collapse multiple repeated phrases (very naive): if more than 3 consecutive same sentence chunks, keep one
  out = out.replace(/(\b[\s\S]{20,400}?\b)(\s*\1){2,}/g, "$1");
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 40).trim();
    out += "\n\nsorry, that's a lot — please narrow your question so i can fit it here 💖";
  }
  return out;
}

async function callMistral(messages: Array<{ role: string; content: string }>) {
  const resp = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MISTRAL_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      messages,
      max_tokens: 2000,
      temperature: 0.4,
      top_p: 0.8,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${resp.status}: ${text}`);
  }
  const data = await resp.json();
  const aiReply = data.choices?.[0]?.message?.content?.trim() || "";
  return { raw: data, aiReply };
}

async function handleAI(
  messageOrInteraction: ChatInputCommandInteraction | Message,
  rawPrompt: string,
  isPrefix: boolean,
  userInfo: UserInfo
) {
  const { userId, channelId, nickname, username } = userInfo;
  const conversationKey = `${channelId}:${userId}`;
  Logger.info(`User ${nickname} (${userId}) requested: ${rawPrompt}`);

  // Build conversation history
  let history = userConversations.get(conversationKey) || [];
  const systemMsg = {
    role: "system",
    content: SYSTEM_MESSAGE_TEMPLATE.content.replace(/{USER_NICKNAME}/g, nickname).replace(/{USER_USERNAME}/g, username),
  };
  if (!history.length) history.push(systemMsg);
  else if (history[0].content !== systemMsg.content) {
    history = [systemMsg, ...history.filter((m) => m.role !== "system")];
  }

  const prompt = sanitizeMentions(rawPrompt);
  history.push({ role: "user", content: prompt.trim() });

  // Trim if too long
  if (JSON.stringify(history).length >= 256_000) {
    history.splice(1, 30);
    Logger.info("trimmed last 30 messages due to large conversation size");
  }
  if (history.length > MAX_HISTORY + 1) history = [history[0], ...history.slice(-MAX_HISTORY)];

  // typing indicator (only for prefix message flow). keep alive while we do the model + searches.
  let stopTyping = () => {};
  try {
    const channelForTyping = isPrefix ? (messageOrInteraction as Message).channel : (messageOrInteraction as ChatInputCommandInteraction).channel;
    stopTyping = startTypingIndicator(channelForTyping as any);

    // initial call to Mistral
    const { aiReply: firstReplyRaw, raw: firstRaw } = await callMistral(history);
    let aiReply = firstReplyRaw || "hmm, i'm having trouble thinking right now 😅 can you try asking again? 💖";
    Logger.info(`first AI response for user ${nickname} (${userId}): ${aiReply.substring(0, 200)}...`);

    // debug raw snippet
    Logger.debug && Logger.debug(`raw model output snippet: ${JSON.stringify(firstRaw).slice(0, 1000)}`);

    aiReply = sanitizeMentions(aiReply);

    // detect all search commands (if any) using tolerant regex
    const commands = parseSearchCommands(aiReply);

    // if the model emitted search tokens, discard any assistant pre-search text and perform the searches
    if (commands.length > 0) {
      // find first token match index (tolerant)
      const firstMatch = TOKEN_REGEX_SINGLE.exec(aiReply);
      TOKEN_REGEX_SINGLE.lastIndex = 0; // reset after exec
      if (firstMatch) {
        const tokenStart = aiReply.indexOf(firstMatch[0]);
        if (tokenStart > 0) {
          Logger.info("discarding assistant pre-search text to avoid leaking model placeholders.");
          const discarded = aiReply.slice(0, Math.min(200, tokenStart)).replace(/\s+/g, " ").trim();
          Logger.debug && Logger.debug(`discarded pre-search assistant text: ${discarded}`);
        }
      }

      // perform each search and inject as a user message (with hidden prefix + 'Searchresults:')
      for (const cmd of commands) {
        Logger.info(`performing search for: "${cmd.query}" (lang=${cmd.lang}, limit=${cmd.num})`);
        let searchResults: SearchResponse | any = null;
        try {
          try {
            searchResults = await (searchInternet as any)(cmd.query, cmd.lang, cmd.num);
          } catch {
            try {
              searchResults = await (searchInternet as any)(cmd.query, cmd.num, cmd.lang);
            } catch {
              searchResults = await (searchInternet as any)(cmd.query);
            }
          }
        } catch (err: any) {
          Logger.error("searchInternet error:", err);
          const errMsg = `search failed for "${cmd.query}": ${err.message || String(err)}`;

          // inject as user message with hidden prefix + Searchresults:
          history.push({
            role: "user",
            content: `${HIDDEN_SEARCH_PREFIX}Searchresults:\n\n${errMsg}`,
          });

          await logSearchEntry({
            timestamp: new Date().toISOString(),
            channelId,
            userId,
            query: cmd.query,
            lang: cmd.lang,
            requestedLimit: cmd.num,
            found: false,
            resultCount: 0,
            topUrls: [],
          });
          continue;
        }

        // analyze results and log
        const { count, urls } = extractResultCountAndUrls(searchResults);
        const found = count > 0;
        Logger.info(`search result for "${cmd.query}": found=${found} count=${count}`);
        await logSearchEntry({
          timestamp: new Date().toISOString(),
          channelId,
          userId,
          query: cmd.query,
          lang: cmd.lang,
          requestedLimit: cmd.num,
          found,
          resultCount: count,
          topUrls: urls,
        });

        // inject formatted results as a user message with the hidden prefix + Searchresults:
        const formatted = formatSearchResults(searchResults, cmd.num);
        const userSearchMsg = `${HIDDEN_SEARCH_PREFIX}Searchresults:\n\n${formatted}`;

        if (!found) {
          history.push({
            role: "user",
            content: `${HIDDEN_SEARCH_PREFIX}Searchresults:\n\nno results found for "${cmd.query}".`,
          });
        } else {
          history.push({
            role: "user",
            content: userSearchMsg,
          });
        }
      }

      // push a short, explicit instruction so the model must use the injected results
      const postSearchInstruction = `you were given search results injected as user messages prefixed with ${HIDDEN_SEARCH_PREFIX}Searchresults:. answer the original user question ("${prompt.trim()}") using ONLY the information in those search results. do not include the hidden prefix or the literal string "Searchresults:" in your reply. synthesize a concise answer (<= ${MAX_ASSISTANT_REPLY} characters) in rinai's persona (lowercase, big-sis emojis allowed). when you mention a source, cite it using the injected order as [1], [2], etc. if the search results don't contain enough info, reply exactly: "the search didn't find enough info about that". do not perform any further web searches.`;

      history.push({ role: "system", content: postSearchInstruction });

      // request a follow-up completion from the model with the injected user-prefixed search results
      const { aiReply: followUp } = await callMistral(history);
      aiReply = sanitizeMentions(followUp || "i got the search results but couldn't form a reply, sorry!");
      aiReply = squashRepeatedLines(aiReply, MAX_ASSISTANT_REPLY);
      history.push({ role: "assistant", content: aiReply });
    } else {
      // normal path: AI did not ask for a search. collapse repeats and limit size
      aiReply = squashRepeatedLines(aiReply, MAX_ASSISTANT_REPLY);

      // as an extra defense: if the reply looks like it's just echoing the system prompt, replace with concise greeting
      const sysPreview = SYSTEM_MESSAGE_TEMPLATE.content.slice(0, 200).replace(/\s+/g, " ").trim().toLowerCase();
      const replyPreview = aiReply.slice(0, 200).replace(/\s+/g, " ").trim().toLowerCase();
      if (replyPreview.includes(sysPreview.slice(0, 80))) {
        // suspicious: assistant is parroting system. replace with short greeting
        aiReply = `hey ${nickname}! i'm rinai — what can i help you with? 💖`;
      }

      history.push({ role: "assistant", content: aiReply });
    }

    // save conversation
    userConversations.set(conversationKey, history);
    await saveConversations();

    // stop typing indicator now that we're about to send
    stopTyping();

    // split and send the final aiReply
    const parts = splitMessage(aiReply);
    if (parts.length === 1) {
      if (isPrefix) await (messageOrInteraction as Message).reply(parts[0]);
      else await (messageOrInteraction as ChatInputCommandInteraction).editReply(parts[0]);
    } else {
      const [first, ...rest] = parts;
      if (isPrefix) {
        const msg = messageOrInteraction as Message;
        await msg.reply(first);
        for (const p of rest) await msg.channel.send(p);
      } else {
        const ic = messageOrInteraction as ChatInputCommandInteraction;
        await ic.editReply(first);
        for (const p of rest) await ic.followUp(p);
      }
    }
  } catch (err: any) {
    // ensure typing indicator is stopped on error too
    try { stopTyping(); } catch {}
    Logger.error("handleAI failed:", err);
    const errMsg = `😢 oops, something went wrong: ${err.message}`;
    if (!isPrefix && (messageOrInteraction as ChatInputCommandInteraction).deferred) {
      await (messageOrInteraction as ChatInputCommandInteraction).editReply(errMsg);
    } else {
      await (messageOrInteraction as Message).reply(errMsg);
    }
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("ask rinai anything!")
    .addStringOption((opt) =>
      opt.setName("prompt").setDescription("your question").setRequired(true)
    )
    .setDMPermission(true),
  prefix: {
    aliases: ["chat", "ai", "rin", "rinai"],
    usage: "<your question> or reply to rinai",
  },
  async execute(interaction, isPrefix = false) {
    try {
      let rawPrompt = "";
      let userInfo: UserInfo;
      if (isPrefix) {
        const msg = interaction as Message;
        const prefix = process.env.PREFIX || "jam!";
        if (!msg.content.toLowerCase().startsWith(prefix)) return;
        const args = msg.content.slice(prefix.length).trim().split(/ +/);
        const cmd = args.shift()?.toLowerCase();
        if (!cmd || !this.prefix!.aliases!.includes(cmd)) return;
        rawPrompt = args.join(" ");
        if (!rawPrompt.trim()) {
          await msg.reply("hey! what did you wanna ask me? 🥺💖");
          return;
        }
        userInfo = {
          username: msg.author.username,
          nickname: (msg.member as GuildMember)?.displayName || msg.author.username,
          userId: msg.author.id,
          channelId: msg.channelId,
        };
        await handleAI(msg, rawPrompt, true, userInfo);
      } else {
        const slash = interaction as ChatInputCommandInteraction;
        if (!slash.deferred) await slash.deferReply();
        rawPrompt = slash.options.getString("prompt", true);
        let nickname = slash.user.username;
        if (slash.inGuild()) {
          const member = slash.member as GuildMember;
          nickname = member.displayName || slash.user.username;
        }
        userInfo = {
          username: slash.user.username,
          nickname,
          userId: slash.user.id,
          channelId: slash.channelId!,
        };
        await handleAI(slash, rawPrompt, false, userInfo);
      }
    } catch (err: any) {
      Logger.error("rinai chat error:", err);
      const errMsg = `😢 oops, something went wrong: ${err.message}`;
      if (!isPrefix && (interaction as ChatInputCommandInteraction).deferred) {
        (interaction as ChatInputCommandInteraction).editReply(errMsg);
      } else {
        (interaction as Message).reply(errMsg);
      }
    }
  },
};

