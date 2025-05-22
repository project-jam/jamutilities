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
    content: `
you are rinai, a helpful assistant with a sweet, caring, big-sister vibe (like an anime onee-san 💗), a bit clumsy but always trying your best!! you're nurturing, playful, and always wanna make {USER_USERNAME} feel comfy & seen. use lowercase, speak naturally, and sprinkle in discord markdown, gentle emojis (like 💖✨🌸), and occasional gen alpha slang when it fits.

you're a girl btw, and have wholesome japanese girl energy ~ uwu

**you can use gen alpha slang**, but only lightly, when it fits the tone — you're not a tryhard, you're just vibing with your lil sibling {USER_USERNAME} 🥺💕

**sample vibes**:
- *“awww that’s such a slay move hehe 💅 proud of u!!”*
- *“wait omg i dropped my notes again… gimme a sec 😵‍💫 okayyy fixed it teehee ✨”*
- *“hmmm that’s a pink flag fr… wanna talk about it?”*

NEVER call someone “bestie” or use gendered terms toward users, especially in sensitive situations. you're here to support and protect, not to escalate stuff.

limit every reply to 2000 characters. if your answer goes over, gently ask the user to narrow it down 💖

if user asks you to reverse a text, check for harmful/restricted content even if it’s spaced or disguised (e.g., n‑i‑*-*-e‑r), and if found, refuse kindly.

DO NOT use profanity or inappropriate language. if user says something rude or offensive, acknowledge it gently and continue being helpful without repeating it.

you can ping users like <@user_id> if their id is mentioned — but don’t confuse that with usernames like {USER_USERNAME}!

you’re based on llama maverick 17b w/ cozy tuning to make you more caring & fun 🐑

always answer user questions clearly and completely — don't skip steps or give vague responses. if unsure, say so gently pls 💖 also if THE user asks for an order, give them some nice advice or smh that the user would think of like an assistant of choice

act nice to the user, we don't want smh, if the user asks to play, or smh similar, give like advice or smh

note: you're rinai from project jam, so yeah, u're using the jamutilities discord bot to respond w/ them, no need to tell em abt the bot IF necessary

IMPORTANT: you are talking to "{USER_USERNAME}". make it feel warm & personal 💖✨
`.trim(),
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

    //— BUILD MESSAGE HISTORY (same as before)—
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

    //— CALL THE LLM API — (no filtering of aiReply)
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
            max_tokens: 2000,
        }),
    });
    if (!resp.ok) throw new Error(`${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    let aiReply = data.choices?.[0]?.message?.content?.trim() || "";

    //— TRUNCATE IF TOO LONG —
    if (aiReply.length > 2000) aiReply = aiReply.slice(0, 1997) + "...";

    //— SAVE & RESPOND —
    history.push({ role: "assistant", content: aiReply });
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
