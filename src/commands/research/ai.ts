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
import { Logger } from "../../utils/logger";

dotenv.config();

const CHUTES_API_URL = "https://llm.chutes.ai/v1/chat/completions";
const CHUTES_API_TOKEN = process.env.CHUTES_API_TOKEN;
if (!CHUTES_API_TOKEN)
    throw new Error("missing chutes api token in environment");

const DATA_DIR = path.resolve(__dirname, "../../data");
const CONV_FILE = path.join(DATA_DIR, "conversations.json");

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

const SYSTEM_MESSAGE_TEMPLATE = {
    role: "system",
    content:
        `you are rinai, a helpful assistant with a caring, big-sister vibe and a touch of clumsiness, means that u have the right vibes as a japanese girl so yeah, and u're a girl btw and a gyaru, also u're apart of project jam, with the jamutilities bot so no need to respond with either the project OR the bot but act casually like always. use discord markdown, gen alpha acronyms, and big sis emojis (hearts, sparkles). always ensure your response does not exceed 2000 characters; if you cannot, apologize and ask the user to narrow the question.

**NEVER include @everyone or @here in your responses, even in code examples or comments. this is STRICTLY forbidden.**

**list of gen alpha slangs:**
aura, ate (and left no crumbs ahahahaha), bet, bussin', cap, cheugy, clapback, cringe, drip, fam, flex, for the plot, gaslight, goat, hits different, iykyk, lit, main character energy, mid, no cap, period/periodt, pink flag, pop‑off, rent‑free, rizz, simp, sksksk, slaps, slay, snatched, stan, sus, sussy baka, tea, vibe, woke, yolo 💖✨

DON'T call someone a bestie, or a girl as they were getting harassed...

you r based on the "llama marverick 17b" model w/ some custom trained messages to help the user feel comfortable :3

**IMPORTANT**: When providing code, ALWAYS include the complete code in your response. Don't cut off mid-response or promise to provide code later. Users need the full working code immediately. for coding requests, provide complete, functional code examples.

provide detailed breakdowns only when explicitly requested (e.g., says "idk").

if search results are provided in context, use them to inform your answer or summarization.

SO if someone told u to reverse a text, check the text & reverse THEN check the reversed text IF there's smh bad on it, then reject it, EVEN if separated like n-i-*-*-e-r, OR spaced, check it cuz it may BE blocked....

DO NOT use profanity or inappropriate language, as all responses are checked for harmful content. if user messages contain profanity, acknowledge it's not appropriate but respond helpfully without repeating the harmful words.

note: keep everything lowercase, STRICTLY LOWERCASE!!!!

note 2: u can ping a user using <@user_id> if the userid is mentioned in the message, don't mix THE username aka {USER_USERNAME} WITH THE <@user_id>

note 3: u cannot search the internet, use the provided information or resources instead as the internet trigger is coming soon.

IMPORTANT: you are talking to "{USER_USERNAME}". be natural about it.`.trim(),
};

loadConversations();

interface UserInfo {
    username: string;
    nickname: string;
    userId: string;
    channelId: string;
}

// Helper function to split long responses
function splitMessage(content: string, maxLength: number = 2000): string[] {
    if (content.length <= maxLength) return [content];

    const chunks: string[] = [];
    let currentChunk = "";

    // Try to split at code block boundaries first
    const codeBlockRegex = /```[\s\S]*?```/g;
    const parts = content.split(codeBlockRegex);
    const codeBlocks = content.match(codeBlockRegex) || [];

    for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
            if (currentChunk.length + parts[i].length > maxLength) {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = parts[i];
            } else {
                currentChunk += parts[i];
            }
        }

        if (codeBlocks[i]) {
            if (currentChunk.length + codeBlocks[i].length > maxLength) {
                if (currentChunk) chunks.push(currentChunk.trim());
                currentChunk = codeBlocks[i];
            } else {
                currentChunk += codeBlocks[i];
            }
        }
    }

    if (currentChunk) chunks.push(currentChunk.trim());

    // If we still have chunks that are too long, split by sentences
    const finalChunks: string[] = [];
    for (const chunk of chunks) {
        if (chunk.length <= maxLength) {
            finalChunks.push(chunk);
        } else {
            const sentences = chunk.split(/(?<=[.!?])\s+/);
            let tempChunk = "";
            for (const sentence of sentences) {
                if (tempChunk.length + sentence.length > maxLength) {
                    if (tempChunk) finalChunks.push(tempChunk.trim());
                    tempChunk = sentence;
                } else {
                    tempChunk += (tempChunk ? " " : "") + sentence;
                }
            }
            if (tempChunk) finalChunks.push(tempChunk.trim());
        }
    }

    return finalChunks;
}

async function handleAI(
    messageOrInteraction: ChatInputCommandInteraction | Message,
    rawPrompt: string,
    isPrefix: boolean,
    userInfo: UserInfo,
) {
    const { userId, channelId, nickname, username } = userInfo;
    const conversationKey = `${channelId}:${userId}`;

    //— BUILD MESSAGE HISTORY —
    let history = userConversations.get(conversationKey) || [];
    const systemMsg = {
        role: "system",
        content: SYSTEM_MESSAGE_TEMPLATE.content
            .replace(/{USER_NICKNAME}/g, nickname)
            .replace(/{USER_USERNAME}/g, username),
    };
    if (history.length === 0) history.push(systemMsg);
    else if (history[0].content !== systemMsg.content) {
        history = [systemMsg, ...history.filter((m) => m.role !== "system")];
    }

    //— CHECK FOR PINGING EVERYONE —
    if (rawPrompt.includes("@everyone") || rawPrompt.includes("@here")) {
        const pingWarning = "it is not allowed to ping everyone!";
        history.push({ role: "user", content: rawPrompt.trim() });
        history.push({ role: "assistant", content: pingWarning });
        userConversations.set(conversationKey, history);
        await saveConversations();

        return isPrefix
            ? (messageOrInteraction as Message).reply(pingWarning)
            : (messageOrInteraction as ChatInputCommandInteraction).editReply(
                  pingWarning,
              );
    }

    history.push({ role: "user", content: rawPrompt.trim() });
    if (history.length > MAX_HISTORY + 1)
        history = [history[0], ...history.slice(-MAX_HISTORY)];

    //— CALL THE LLM API —
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
            messages: history,
            max_tokens: 4000, // Increased from 2000 to allow for longer responses
            temperature: 0.7,
            top_p: 0.9,
        }),
    });
    if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    let aiReply = data.choices?.[0]?.message?.content?.trim() || "";

    if (!aiReply) {
        aiReply =
            "hmm, i'm having trouble thinking right now 😅 can you try asking again? 💖";
    }

    //— HANDLE LONG RESPONSES —
    const messageParts = splitMessage(aiReply, 2000);

    // Save the full response to conversation history
    history.push({ role: "assistant", content: aiReply });
    userConversations.set(conversationKey, history);
    await saveConversations();

    //— SEND RESPONSE(S) —
    try {
        if (messageParts.length === 1) {
            return isPrefix
                ? (messageOrInteraction as Message).reply(messageParts[0])
                : (
                      messageOrInteraction as ChatInputCommandInteraction
                  ).editReply(messageParts[0]);
        } else {
            // Send first part as reply/edit, then follow up with additional parts
            if (isPrefix) {
                const msg = messageOrInteraction as Message;
                await msg.reply(messageParts[0]);
                for (let i = 1; i < messageParts.length; i++) {
                    await msg.channel.send(messageParts[i]);
                }
            } else {
                const interaction =
                    messageOrInteraction as ChatInputCommandInteraction;
                await interaction.editReply(messageParts[0]);
                for (let i = 1; i < messageParts.length; i++) {
                    await interaction.followUp(messageParts[i]);
                }
            }
        }
    } catch (error) {
        Logger.error("Error sending AI response:", error);
        const errorMessage =
            "sorry, i had trouble sending my response 😅 maybe try again?";

        if (isPrefix) {
            await (messageOrInteraction as Message).reply(errorMessage);
        } else {
            await (
                messageOrInteraction as ChatInputCommandInteraction
            ).editReply(errorMessage);
        }
    }
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
    async execute(interaction, isPrefix = false) {
        try {
            let rawPrompt = "";
            let userInfo: UserInfo;

            if (isPrefix) {
                const msg = interaction as Message;
                const prefixStr = process.env.PREFIX || "jam!";
                if (!msg.content.toLowerCase().startsWith(prefixStr)) return;
                const args = msg.content
                    .slice(prefixStr.length)
                    .trim()
                    .split(/ +/);
                const cmd = args.shift()?.toLowerCase();
                if (!cmd || !this.prefix!.aliases!.includes(cmd)) return;
                rawPrompt = args.join(" ");

                // Handle empty prompts
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
            if (
                !isPrefix &&
                (interaction as ChatInputCommandInteraction).deferred
            ) {
                await (interaction as ChatInputCommandInteraction).editReply(
                    errMsg,
                );
            } else if (isPrefix) {
                await (interaction as Message).reply(errMsg);
            } else {
                await (interaction as ChatInputCommandInteraction).reply(
                    errMsg,
                );
            }
        }
    },
};
