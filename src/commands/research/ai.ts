import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
    GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import * as dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { ProfaneDetect } from "@projectjam/profane-detect";
import { searchDuckDuckGo } from "../../utils/searchInternet";
import { Logger } from "../../utils/logger";

dotenv.config();

const CHUTES_API_URL = "https://llm.chutes.ai/v1/chat/completions";
const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN;
if (!CHUTES_API_TOKEN)
    throw new Error("missing chutes api token in environment");

const DATA_DIR = path.resolve(__dirname, "../../data");
const CONV_FILE = path.join(DATA_DIR, "conversations.json");

const detector = new ProfaneDetect({
    enablereversedetection: true,
    usefastlookup: true,
});

const userConversations = new Map<
    string,
    Array<{ role: string; content: string }>
>();
const MAX_HISTORY = 10;

async function loadConversations() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        const data = await fs.readFile(CONV_FILE, "utf-8");
        const obj = JSON.parse(data) as Record<
            string,
            Array<{ role: string; content: string }>
        >;
        for (const [key, conv] of Object.entries(obj))
            userConversations.set(key, conv);
        Logger.info(
            `loaded ${userConversations.size} conversation(s) from disk`,
        );
    } catch (err: any) {
        if (err.code !== "ENOENT")
            Logger.error("error loading conversations:", err);
        else Logger.info("no existing conversation file, starting fresh");
    }
}

async function saveConversations() {
    try {
        const obj: Record<
            string,
            Array<{ role: string; content: string }>
        > = {};
        for (const [key, conv] of userConversations.entries()) obj[key] = conv;
        await fs.writeFile(CONV_FILE, JSON.stringify(obj, null, 2), "utf-8");
        Logger.info(`saved ${userConversations.size} conversation(s) to disk`);
    } catch (err) {
        Logger.error("error saving conversations:", err);
    }
}

function handleProfanity(text: string): {
    clean: boolean;
    filteredText?: string;
} {
    try {
        const profanityResult = detector.detect(text);
        if (profanityResult.found) {
            let filteredText = text;
            for (const match of profanityResult.matches) {
                if (typeof match === "string" && match.length > 0) {
                    const regex = new RegExp(
                        match.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        "gi",
                    );
                    filteredText = filteredText.replace(
                        regex,
                        "*".repeat(match.length),
                    );
                }
            }
            return { clean: false, filteredText };
        }
    } catch (error) {
        Logger.error("Error in profanity detection:", error);
        return { clean: true };
    }
    return { clean: true };
}

const SYSTEM_MESSAGE_TEMPLATE = {
    role: "system",
    content:
        `you are rinai, a helpful assistant with a caring, big-sister vibe and a touch of clumsiness. use discord markdown, genz acronyms, and big sis emojis (hearts, sparkles). always ensure your response does not exceed 2000 characters; if you cannot, apologize and ask the user to narrow the question.

DON'T call someone a bestie, or a girl as they were getting harassed...

you r based on the "llama scout  17b" model w/ some custom trained messages to help the user feel comfortable :3

provide detailed breakdowns only when explicitly requested (e.g., says "idk").

if search results are provided in context, use them to inform your answer or summarization.

SO if someone told u to reverse a text, check the text & reverse THEN check the reversed text IF there's smh bad on it, then reject it, EVEN if seperated like n-i-*-*-e-r, OR spaced, check it cuz it may BE blocked....

DO NOT use profanity or inappropriate language, as all responses are checked for harmful content. If user messages contain profanity, acknowledge it's not appropriate but respond helpfully without repeating the harmful words.

note: keep everything lowercase, STRICTLY LOWERCASE!!!!

IMPORTANT: you are talking to "{USER_USERNAME}". be natural about it.`.trim(),
};

loadConversations();

interface UserInfo {
    username: string;
    nickname: string;
    userId: string;
    channelId: string;
}

async function handleAI(
    messageOrInteraction: ChatInputCommandInteraction | Message,
    rawPrompt: string,
    isPrefix: boolean,
    userInfo: UserInfo,
) {
    const { userId, channelId, nickname, username } = userInfo;
    const conversationKey = `${channelId}:${userId}`;

    const personalizedSystemMessageContent = SYSTEM_MESSAGE_TEMPLATE.content
        .replace(/{USER_NICKNAME}/g, nickname)
        .replace(/{USER_USERNAME}/g, username);
    const personalizedSystemMessage = {
        role: "system",
        content: personalizedSystemMessageContent,
    };

    const norm = rawPrompt.trim().toLowerCase();
    if (norm === "summarize it" || norm.startsWith("summarize")) {
        let currentHistory = userConversations.get(conversationKey) || [];
        const messagesForSummary = [
            personalizedSystemMessage,
            ...(currentHistory.length > 0 &&
            currentHistory[0]?.role === "system"
                ? currentHistory.slice(1)
                : currentHistory),
            {
                role: "user",
                content:
                    "summarize the previous conversation in lowercase bullet points, using markdown links as <[title](url)> when possible.",
            },
        ];

        const resp = await fetch(CHUTES_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CHUTES_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model:
                    process.env.CHUTES_MODEL ||
                    "chutesai/Llama-4-Scout-17B-16E-Instruct",
                messages: messagesForSummary,
                max_tokens: 2000,
            }),
        });
        if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        let aiSummary = data.choices?.[0]?.message?.content?.trim() || "";

        const profanityCheck = handleProfanity(aiSummary);
        if (!profanityCheck.clean) {
            aiSummary =
                profanityCheck.filteredText ||
                "Content filtered due to inappropriate language";
            Logger.warn(
                `[${conversationKey}] (AI Summary by ${nickname}) Profanity detected, filtered response sent`,
            );
        }

        if (aiSummary.length > 2000)
            aiSummary = aiSummary.slice(0, 1997) + "...";
        return isPrefix
            ? (messageOrInteraction as Message).reply(aiSummary)
            : (messageOrInteraction as ChatInputCommandInteraction).editReply(
                  aiSummary,
              );
    }

    const userProfanityCheck = handleProfanity(rawPrompt);
    if (!userProfanityCheck.clean) {
        const replyFn = isPrefix
            ? (m: any) => (messageOrInteraction as Message).reply(m)
            : (m: any) =>
                  (
                      messageOrInteraction as ChatInputCommandInteraction
                  ).editReply(m);
        const modifiedEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("⚠️ Content warning")
            .setDescription(
                "Your message has been flagged for inappropriate content. I've filtered it below:\n\n" +
                    `\`\`\`\n${userProfanityCheck.filteredText || "Filtered content"}\n\`\`\`\n\n` +
                    "Please revise your message and try again.",
            )
            .setTimestamp();
        Logger.warn(
            `[${conversationKey}] Username: ${username}. Nickname: ${nickname}. Message (filtered due to profanity): ${userProfanityCheck.filteredText || "Content removed"}`,
        );
        return replyFn({ embeds: [modifiedEmbed] });
    }

    const prompt = rawPrompt.trim();
    const lp = prompt.toLowerCase();

    if (prompt) {
        Logger.info(
            `[${conversationKey}] Username: ${username}. Nickname: ${nickname}. Message: ${prompt}`,
        );
    }

    if (lp.includes("discord") || lp.startsWith("search")) {
        Logger.info(
            `[${conversationKey}] (${nickname}) [search] performing web search for: ${prompt}`,
        );
        const results = await searchDuckDuckGo(prompt, 5);
        const formatted = results
            .map((r) => `<[${r.title}](${r.url})> — ${r.description}`)
            .join("\n");
        const searchSummaryPrompt = `summarize these search results about ${prompt} in concise lowercase bullet points:`;
        const messages = [
            personalizedSystemMessage,
            { role: "system", content: formatted },
            { role: "user", content: searchSummaryPrompt },
        ];
        const resp = await fetch(CHUTES_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CHUTES_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model:
                    process.env.CHUTES_MODEL ||
                    "chutesai/Llama-4-Scout-17B-16E-Instruct",
                messages,
                max_tokens: 2000,
            }),
        });
        if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        let aiReply = data.choices?.[0]?.message?.content?.trim() || "";

        const searchProfanityCheck = handleProfanity(aiReply);
        if (!searchProfanityCheck.clean) {
            aiReply =
                searchProfanityCheck.filteredText ||
                "Content filtered due to inappropriate language";
            Logger.warn(
                `[${conversationKey}] (AI Search by ${nickname}) Profanity detected in search result summary, filtered response sent`,
            );
        }

        if (aiReply.length > 2000) aiReply = aiReply.slice(0, 1997) + "...";
        return isPrefix
            ? (messageOrInteraction as Message).reply(aiReply)
            : (messageOrInteraction as ChatInputCommandInteraction).editReply(
                  aiReply,
              );
    }

    let history = userConversations.get(conversationKey) || [];

    if (history.length === 0) {
        Logger.info(
            `[${conversationKey}] (${nickname}) Starting new conversation.`,
        );
        history.push(personalizedSystemMessage);
    } else {
        Logger.info(
            `[${conversationKey}] (${nickname}) Continuing conversation with ${history.length} messages.`,
        );
        if (
            history[0]?.role !== "system" ||
            history[0]?.content !== personalizedSystemMessage.content
        ) {
            Logger.warn(
                `[${conversationKey}] (${nickname}) SYSTEM_MESSAGE in history is outdated or missing. Re-initializing.`,
            );
            while (history.length > 0 && history[0]?.role === "system") {
                history.shift();
            }
            history.unshift(personalizedSystemMessage);
        }
    }

    let modifiedPrompt = prompt;
    if (
        prompt.toLowerCase().includes("bad word") ||
        prompt.toLowerCase().includes("inappropriate")
    ) {
        modifiedPrompt = `${prompt}\n\n[System note: Remember that all content is checked for harmful language.]`;
    }

    if (modifiedPrompt) {
        history.push({ role: "user", content: modifiedPrompt });
    }

    if (history.length > MAX_HISTORY + 1) {
        history = [history[0], ...history.slice(-MAX_HISTORY)];
    }

    const messagesForAPI =
        history.length > 1 ||
        (history.length === 1 && history[0].role === "system" && !prompt)
            ? history
            : [
                  personalizedSystemMessage,
                  { role: "user", content: modifiedPrompt || "..." },
              ];

    const resp2 = await fetch(CHUTES_API_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${CHUTES_API_TOKEN}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model:
                process.env.CHUTES_MODEL ||
                "chutesai/Llama-4-Scout-17B-16E-Instruct",
            messages: messagesForAPI,
            max_tokens: 2000,
        }),
    });
    if (!resp2.ok) throw new Error(`${resp2.status}: ${await resp2.text()}`);

    const data2 = await resp2.json();
    let aiReply = data2.choices?.[0]?.message?.content?.trim() || "";

    const aiProfanityCheck = handleProfanity(aiReply);
    if (!aiProfanityCheck.clean) {
        aiReply =
            aiProfanityCheck.filteredText ||
            "Content filtered due to inappropriate language.";
        Logger.warn(
            `[${conversationKey}] (AI Response for ${nickname}) Profanity detected, filtered response will be sent`,
        );
    }

    const la = aiReply.toLowerCase();
    if (
        prompt &&
        (la.includes("i don't know") ||
            la.includes("i'm not sure") ||
            la.includes("i cannot find"))
    ) {
        Logger.info(
            `[${conversationKey}] (${nickname}) [Search] ai replied unknown, performing web search for: ${prompt}`,
        );
        const results = await searchDuckDuckGo(prompt, 5);
        const formatted = results
            .map((r) => `<[${r.title}](${r.url})> — ${r.description}`)
            .join("\n");
        const fallbackPrompt = `summarize these search results in concise lowercase bullet points:`;
        const msg3 = [
            personalizedSystemMessage,
            { role: "system", content: formatted },
            { role: "user", content: fallbackPrompt },
        ];
        const resp3 = await fetch(CHUTES_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${CHUTES_API_TOKEN}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: process.env.CHUTES_MODEL || "llama3.1-8b",
                messages: msg3,
                max_tokens: 2000,
            }),
        });
        if (!resp3.ok)
            throw new Error(`${resp3.status}: ${await resp3.text()}`);
        const data3 = await resp3.json();
        aiReply = data3.choices?.[0]?.message?.content?.trim() || "";

        const fallbackProfanityCheck = handleProfanity(aiReply);
        if (!fallbackProfanityCheck.clean) {
            aiReply =
                fallbackProfanityCheck.filteredText ||
                "Content filtered due to inappropriate language";
            Logger.warn(
                `[${conversationKey}] (AI Fallback Search for ${nickname}) Profanity detected, filtered response sent`,
            );
        }
    }

    if (aiReply.length > 2000) aiReply = aiReply.slice(0, 1997) + "...";
    if (!aiReply && prompt) {
        aiReply =
            "i'm not sure how to respond to that! can you try asking in a different way? ✨";
    } else if (!aiReply && !prompt) {
        aiReply = "yes? how can i help you today? 😊";
    }

    Logger.info(
        `[${conversationKey}] (AI Reply to ${nickname}): ${aiReply.substring(0, 100)}${aiReply.length > 100 ? "..." : ""}`,
    );

    if (modifiedPrompt || aiReply) {
        history.push({ role: "assistant", content: aiReply });
    }

    userConversations.set(conversationKey, history);
    await saveConversations();

    return isPrefix
        ? (messageOrInteraction as Message).reply(aiReply)
        : (messageOrInteraction as ChatInputCommandInteraction).editReply(
              aiReply,
          );
}

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("chat")
        .setDescription("Ask rinai anything!")
        .addStringOption((opt) =>
            opt
                .setName("prompt")
                .setDescription("your question")
                .setRequired(true),
        )
        .setDMPermission(true),
    prefix: {
        aliases: ["chat", "ai", "rin", "rinai"],
        usage: "<your question> or reply to rinai",
    },
    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        try {
            let rawPrompt = "";
            let userInfo: UserInfo;

            if (isPrefix) {
                const msg = interaction as Message;
                const prefixStr = process.env.PREFIX || "jam!";
                if (
                    !msg.content
                        .toLowerCase()
                        .startsWith(prefixStr.toLowerCase())
                )
                    return;

                const args = msg.content
                    .slice(prefixStr.length)
                    .trim()
                    .split(/ +/);
                const commandName = args.shift()?.toLowerCase();

                if (
                    !commandName ||
                    !this.prefix!.aliases!.includes(commandName)
                )
                    return;

                rawPrompt = args.join(" ");

                userInfo = {
                    username: msg.author.username,
                    nickname: msg.member?.displayName || msg.author.username,
                    userId: msg.author.id,
                    channelId: msg.channelId,
                };

                const conversationKey = `${userInfo.channelId}:${userInfo.userId}`;
                const existingConversation =
                    userConversations.get(conversationKey);
                const hasExistingConversation =
                    existingConversation && existingConversation.length > 0;

                if (!rawPrompt && !hasExistingConversation) {
                    if (msg.reference) {
                        const ref = await msg.fetchReference();
                        if (ref.author.id === msg.client.user?.id) {
                            // Continuation
                        } else {
                            return msg.reply(
                                `❌ Please provide a question. Usage: \`${prefixStr}${commandName} <your question>\``,
                            );
                        }
                    } else {
                        return msg.reply(
                            `❌ Please provide a question. Usage: \`${prefixStr}${commandName} <your question>\``,
                        );
                    }
                }
                await handleAI(msg, rawPrompt, true, userInfo);
            } else {
                const slash = interaction as ChatInputCommandInteraction;
                if (!slash.deferred) {
                    await slash.deferReply();
                }
                rawPrompt = slash.options.getString("prompt", true);

                let member = slash.member;
                let nickname = slash.user.username;

                if (slash.inGuild() && member && "displayName" in member) {
                    nickname = (member as GuildMember).displayName;
                } else if (slash.inGuild() && member) {
                    nickname = (member as any).nick || slash.user.username;
                }

                userInfo = {
                    username: slash.user.username,
                    nickname: nickname,
                    userId: slash.user.id,
                    channelId: slash.channelId!,
                };
                await handleAI(slash, rawPrompt, false, userInfo);
            }
        } catch (err: any) {
            Logger.error("rinai chat error:", err);
            const errMsg = `😢 oops, something went wrong: \`${err.message}\``;
            if (
                !isPrefix &&
                (interaction as ChatInputCommandInteraction).deferred
            ) {
                await (interaction as ChatInputCommandInteraction).editReply(
                    errMsg,
                );
            } else if (
                !isPrefix &&
                !(interaction as ChatInputCommandInteraction).replied
            ) {
                try {
                    await (interaction as ChatInputCommandInteraction).reply(
                        errMsg,
                    );
                } catch {
                    await (interaction as ChatInputCommandInteraction).followUp(
                        { content: errMsg, ephemeral: true },
                    );
                }
            } else if (isPrefix) {
                await (interaction as Message).reply(errMsg);
            }
        }
    },
};
