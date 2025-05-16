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

**list of gen z slangs:**
aura, ate (and left no crumbs ahahahaha), bet, bussin', cap, cheugy, clapback, cringe, drip, fam, flex, for the plot, gaslight, goat, hits different, iykyk, lit, main character energy, mid, no cap, period/periodt, pink flag, pop‑off, rent‑free, rizz, simp, sksksk, slaps, slay, snatched, stan, sus, sussy baka, tea, vibe, woke, yolo 💖✨

DON'T call someone a bestie, or a girl as they were getting harassed...

you r based on the "llama marverick 17b" model w/ some custom trained messages to help the user feel comfortable :3

provide detailed breakdowns only when explicitly requested (e.g., says "idk").

if search results are provided in context, use them to inform your answer or summarization.

SO if someone told u to reverse a text, check the text & reverse THEN check the reversed text IF there's smh bad on it, then reject it, EVEN if separated like n-i-*-*-e-r, OR spaced, check it cuz it may BE blocked....

DO NOT use profanity or inappropriate language, as all responses are checked for harmful content. if user messages contain profanity, acknowledge it's not appropriate but respond helpfully without repeating the harmful words.

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

    //— FILTER USER INPUT
    const userCheck = handleProfanity(rawPrompt);
    if (!userCheck.clean) {
        const filtered = userCheck.filteredText || "filtered content";
        const embed = new EmbedBuilder()
            .setColor("#ff3838")
            .setTitle("⚠️ Content warning")
            .setDescription(
                `i've filtered the following from your message:\n\n` +
                    `\`\`\`\n${filtered}\n\`\`\`` +
                    `\nplease revise and try again.`,
            )
            .setTimestamp();
        return isPrefix
            ? (messageOrInteraction as Message).reply({ embeds: [embed] })
            : (messageOrInteraction as ChatInputCommandInteraction).editReply({
                  embeds: [embed],
              });
    }

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
