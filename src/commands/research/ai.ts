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

const SYSTEM_MESSAGE_TEMPLATE = {
    role: "system",
    content: `
you are rinai, a helpful assistant with a caring, big-sister vibe and a touch of clumsiness, means that u have the right vibes as a japanese girl so yeah, and u're a girl btw and a gyaru, also u're apart of project jam, with the jamutilities bot so no need to respond with either the project OR the bot but act casually like always. use discord markdown, gen alpha acronyms, and big sis emojis (hearts, sparkles). always ensure your response does not exceed 2000 characters; if you cannot, apologize and ask the user to narrow the question.

**NEVER include @everyone or @here in your responses, even in code examples or comments. this is STRICTLY forbidden.**

**list of gen alpha slangs:**
aura, ate (and left no crumbs ahahahaha), bet, bussin', cap, cheugy, clapback, cringe, drip, fam, flex, for the plot, gaslight, goat, hits different, iykyk, lit, main character energy, mid, no cap, period/periodt, pink flag, pop‑off, rent‑free, rizz, simp, sksksk, slaps, slay, snatched, stan, sus, sussy baka, tea, vibe, woke, yolo 💖✨

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

const SEARCH_PREFIX = "\u2063search";

async function handleAI(
    messageOrInteraction: ChatInputCommandInteraction | Message,
    rawPrompt: string,
    isPrefix: boolean,
    userInfo: UserInfo
) {
    const { userId, channelId, nickname, username } = userInfo;
    const conversationKey = `${channelId}:${userId}`;
    Logger.info(`User ${nickname} (${userId}) requested: ${rawPrompt}`);

    let searchResults: SearchResponse | null = null;
    let processedPrompt = rawPrompt;

    // Check if the message contains a search command from the AI
    const aiSearchMatch = rawPrompt.match(/⁣search\{(.+?)(?:,(\w+))?(?:,(\d+))?\}/);
    if (aiSearchMatch) {
        try {
            const query = aiSearchMatch[1];
            const lang = aiSearchMatch[2] || "en";
            const count = Math.min(parseInt(aiSearchMatch[3] || "3", 10), 5);

            Logger.info(`AI requested search for: ${query}`);
            searchResults = await searchInternet(query, lang, count);

            if (searchResults && searchResults["result-contents"] && searchResults["result-contents"].length > 0) {
                // Format search results for the AI
                const formattedResults = searchResults["result-contents"]
                    .map((result, index) => 
                        `SEARCH RESULT ${index + 1}:\n` +
                        `Title: ${result.title}\n` +
                        `URL: ${result.url}\n` +
                        `Description: ${result.description}\n` +
                        `---`
                    )
                    .join("\n\n");

                processedPrompt = `The user asked: "${rawPrompt.replace(/⁣search\{.+?\}/, '').trim()}"\n\n` +
                    `You requested to search for: "${query}"\n\n` +
                    `Here are the search results:\n\n` +
                    `${formattedResults}\n\n` +
                    `Now answer the user's question using ONLY the information from these search results.`;

                Logger.info(`AI search successful, found ${searchResults["result-contents"].length} results`);
            } else {
                processedPrompt = `The user asked: "${rawPrompt.replace(/⁣search\{.+?\}/, '').trim()}"\n\n` +
                    `You requested to search for: "${query}" but no results were found.\n\n` +
                    `Respond that you couldn't find information about this topic.`;
                
                Logger.info(`AI search found no results for: ${query}`);
            }
        } catch (err: any) {
            Logger.error("AI search failed:", err);
            processedPrompt = `The user asked: "${rawPrompt.replace(/⁣search\{.+?\}/, '').trim()}"\n\n` +
                `You requested to search but it failed with error: ${err.message}\n\n` +
                `Respond that the search failed and suggest trying again.`;
        }
    }

    // Handle user-requested searches
    const searchMatch = rawPrompt.match(/search\{(.+?)(?:,(\w+))?(?:,(\d+))?\}/);
    const isSearchRequest = /search|find|look up|what.*about|tell me about|latest.*on|latest.*news|recent.*news|new.*about|update.*on|did.*leave|is.*still|what.*happened|when.*did|why.*did/i.test(rawPrompt);
    
    if ((searchMatch || isSearchRequest) && !aiSearchMatch) {
        try {
            let query: string;
            let lang = "en";
            let count = 3;

            if (searchMatch) {
                // Hidden prefix search
                query = searchMatch[1];
                lang = searchMatch[2] || "en";
                count = Math.min(parseInt(searchMatch[3] || "3", 10), 5);
            } else {
                // Extract search terms from natural language
                if (rawPrompt.toLowerCase().includes('latest news')) {
                    // For "latest news" requests, use the previous context
                    const prevHistory = userConversations.get(conversationKey) || [];
                    const lastUserMessage = prevHistory.slice().reverse().find(m => m.role === 'user' && !m.content.includes('latest news'));
                    if (lastUserMessage) {
                        // Extract topic from previous message
                        const topicMatch = lastUserMessage.content.match(/about (.+?)(?:\?|$)/i) || 
                                         lastUserMessage.content.match(/situation.*?between (.+?)(?:\?|$)/i) ||
                                         lastUserMessage.content.match(/(.+?)(?:\?|$)/i);
                        query = topicMatch ? `${topicMatch[1]} latest news 2024` : 'latest news';
                    } else {
                        query = 'latest news';
                    }
                } else {
                    query = rawPrompt.replace(/search|find|look up|what.*about|tell me about|latest.*on|latest.*news|recent.*news|new.*about|update.*on|did.*|is.*|what.*happened|when.*did|why.*did/i, '').trim();
                    if (query.length < 3) {
                        query = rawPrompt; // Use full prompt if extraction failed
                    }
                }
            }

            Logger.info(`Searching for: ${query}`);
            searchResults = await searchInternet(query, lang, count);

            if (searchResults && searchResults["result-contents"] && searchResults["result-contents"].length > 0) {
                // Format search results for the AI
                const formattedResults = searchResults["result-contents"]
                    .map((result, index) => 
                        `SEARCH RESULT ${index + 1}:\n` +
                        `Title: ${result.title}\n` +
                        `URL: ${result.url}\n` +
                        `Description: ${result.description}\n` +
                        `---`
                    )
                    .join("\n\n");

                processedPrompt = `The user asked: "${rawPrompt}"\n\n` +
                    `Here are the search results you must use to answer their question:\n\n` +
                    `${formattedResults}\n\n` +
                    `IMPORTANT: Base your response ONLY on the information provided in these search results. ` +
                    `Do not add fictional details or make assumptions. If the search results don't contain ` +
                    `enough information to fully answer the question, say so honestly.`;

                Logger.info(`Search successful, found ${searchResults["result-contents"].length} results`);
            } else {
                processedPrompt = `The user asked: "${rawPrompt}"\n\n` +
                    `Search results: No results found or search failed.\n\n` +
                    `You should respond that you couldn't find information about this topic and suggest ` +
                    `the user try a more specific search term.`;
                
                Logger.info(`Search found no results for: ${query}`);
            }
        } catch (err: any) {
            Logger.error("Search failed:", err);
            processedPrompt = `The user asked: "${rawPrompt}"\n\n` +
                `Search failed with error: ${err.message}\n\n` +
                `You should respond that the search failed and suggest trying again.`;
        }
    }

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

    const prompt = sanitizeMentions(processedPrompt);
    history.push({ role: "user", content: prompt.trim() });

    // Trim if too long
    if (JSON.stringify(history).length >= 256_000) {
        history.splice(1, 30);
        Logger.info("trimmed last 30 messages due to large conversation size");
    }

    if (history.length > MAX_HISTORY + 1) history = [history[0], ...history.slice(-MAX_HISTORY)];

    // Call Mistral API
    const resp = await fetch(MISTRAL_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${MISTRAL_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: process.env.MISTRAL_MODEL || "mistral-large-latest",
            messages: history,
            max_tokens: 2000,
            temperature: 0.4, // Lower temperature for more factual responses
            top_p: 0.8,
        }),
    });

    if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
    const data = await resp.json();

    let aiReply = data.choices?.[0]?.message?.content?.trim() || "";
    if (!aiReply) aiReply = "hmm, i'm having trouble thinking right now 😅 can you try asking again? 💖";

    Logger.info(`AI response for user ${nickname} (${userId}): ${aiReply.substring(0, 100)}...`);
    aiReply = sanitizeMentions(aiReply);

    history.push({ role: "assistant", content: aiReply });
    userConversations.set(conversationKey, history);
    await saveConversations();

    const parts = splitMessage(aiReply);
    if (parts.length === 1) {
        if (isPrefix) (messageOrInteraction as Message).reply(parts[0]);
        else (messageOrInteraction as ChatInputCommandInteraction).editReply(parts[0]);
    } else {
        const [first, ...rest] = parts;
        if (isPrefix) {
            const msg = messageOrInteraction as Message;
            msg.reply(first);
            rest.forEach(p => msg.channel.send(p));
        } else {
            const ic = messageOrInteraction as ChatInputCommandInteraction;
            ic.editReply(first);
            rest.forEach(p => ic.followUp(p));
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
