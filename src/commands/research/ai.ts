/////////////////////////////////////////////////////
// WARNING: the internet function is still in beta //
/////////////////////////////////////////////////////

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
            arr = JSON.parse(cur);
            if (!Array.isArray(arr)) arr = [];
        } catch (e: any) {
            if (e.code !== "ENOENT") Logger.error("could not read search log file:", e);
        }
        arr.push(entry);
        await fs.writeFile(SEARCH_LOG_FILE, JSON.stringify(arr, null, 2), "utf-8");
        Logger.info(`logged search: "${entry.query}" -> found=${entry.found} count=${entry.resultCount}`);
    } catch (err) {
        Logger.error("failed to append search log:", err);
    }
}

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

note: keep everything lowercase, STRICTLY LOWERCASE!!!!

note 2: u can ping a user using <@user_id> if the userid is mentioned in the message, don't mix THE username aka {USER_USERNAME} WITH THE <@user_id>

note 3: if u don't know something and no search results are provided, you should ask the user to search for it using the search prefix, but NEVER make up information

and note 4: u can use emojis in your responses, but avoid using too many or inappropriate ones. use emojis sparingly and appropriately, and keep ur vibe, casual, big sis vibe, we don't want ppl calling u bad

IMPORTANT: you are talking to "{USER_USERNAME}". be natural about it.

IMPORTANT 2: PROVIDE WITH A FUCKING FULL AND COMPLETE RESPONSE!!!!!! IT ISN'T FUNNY!!!!
IMPORTANT 3: AGAIN, FULL RESPONSE U IDIOT!
IMPORTANT 4: WHEN SEARCH RESULTS ARE PROVIDED, ONLY USE THE INFORMATION FROM THE SEARCH RESULTS. DO NOT ADD FICTIONAL DETAILS.
`.trim(),
};

function sanitizeMentions(text: string) {
    return text.replace(/@everyone/g, "@\u200Beveryone").replace(/@here/g, "@\u200Bhere");
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
                        chunks.push(current.trim());
                        current = w;
                    } else current += w;
                }
            } else current += part;
        }
        const code = codeBlocks[i];
        if (code) {
            if (current.length + code.length > maxLength) {
                chunks.push(current.trim());
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

const SEARCH_PREFIX = "\u2063search"; // invisible-separator + 'search'

// returns all search commands found in the text
function parseSearchCommands(text: string): Array<{ query: string; lang: string; num: number; raw: string }> {
    const out: Array<{ query: string; lang: string; num: number; raw: string }> = [];
    if (!text) return out;
    const re = new RegExp(`${SEARCH_PREFIX}\\{([^}]+)\\}`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        const inside = m[1].trim();
        const parts = inside.split(",").map((p) => p.trim());
        const query = parts[0] || "";
        const lang = parts[1] || "en";
        const num = Math.max(1, Math.min(10, Number(parts[2] || "3") || 3));
        if (query) out.push({ query, lang, num, raw: m[0] });
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
                    const snippet = it.snippet || it.description || it.summary || it.excerpt || "";
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
        content: SYSTEM_MESSAGE_TEMPLATE.content
            .replace(/{USER_NICKNAME}/g, nickname)
            .replace(/{USER_USERNAME}/g, username),
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

    try {
        // initial call to Mistral
        const { aiReply: firstReplyRaw } = await callMistral(history);
        let aiReply = firstReplyRaw || "hmm, i'm having trouble thinking right now 😅 can you try asking again? 💖";
        Logger.info(`first AI response for user ${nickname} (${userId}): ${aiReply.substring(0, 200)}...`);
        aiReply = sanitizeMentions(aiReply);

        // detect all search commands (if any)
        const commands = parseSearchCommands(aiReply);

        // NOTE: no automatic search creation from the user's prompt and no re-prompting of the model.
        // we only perform searches if the model itself emitted the explicit SEARCH token.
        if (commands.length > 0) {
            // IMPORTANT: do NOT keep any placeholder or pre-search assistant text the model emitted.
            const cleanedReply = aiReply.replace(new RegExp(`${SEARCH_PREFIX}\\{[^}]+\\}`, "g"), "").trim();
            if (cleanedReply) {
                Logger.info("model emitted search tokens; discarding any pre-search placeholder text.");
            }

            // perform each search and inject as system messages, and log results
            for (const cmd of commands) {
                Logger.info(`performing search for: "${cmd.query}" (lang=${cmd.lang}, limit=${cmd.num})`);
                let searchResults: SearchResponse | any = null;
                try {
                    // flexible calling attempts - adapt if your util has a specific signature
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
                    history.push({ role: "system", content: errMsg });
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

                // inject formatted results as a system message
                const formatted = formatSearchResults(searchResults, cmd.num);
                const systemSearchMsg = `search results for "${cmd.query}" (lang=${cmd.lang}, limit=${cmd.num}):\n\n${formatted}`;
                if (!found) {
                    history.push({ role: "system", content: `search performed for "${cmd.query}" but returned no results.` });
                } else {
                    history.push({ role: "system", content: systemSearchMsg });
                }
            }

            // request a follow-up completion from the model with the injected results
            const { aiReply: followUp } = await callMistral(history);
            aiReply = sanitizeMentions(followUp || "i got the search results but couldn't form a reply, sorry!");
            history.push({ role: "assistant", content: aiReply });
        } else {
            // normal path: AI did not ask for a search. add assistant reply to history
            history.push({ role: "assistant", content: aiReply });
        }

        // save conversation
        userConversations.set(conversationKey, history);
        await saveConversations();

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
        Logger.error("handleAI failed:", err);
        const errMsg = `😢 oops, something went wrong: \`${err.message}\``;
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
        .addStringOption(opt =>
            opt.setName("prompt")
                .setDescription("your question")
                .setRequired(true)
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
                    nickname: msg.member?.displayName || msg.author.username,
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
            const errMsg = `😢 oops, something went wrong: \`${err.message}\``;
            if (!isPrefix && (interaction as ChatInputCommandInteraction).deferred) {
                (interaction as ChatInputCommandInteraction).editReply(errMsg);
            } else {
                (interaction as Message).reply(errMsg);
            }
        }
    },
};

