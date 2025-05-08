import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../../types/Command';
import * as dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { ProfaneDetect } from '@projectjam/profane-detect';
import { searchDuckDuckGo } from '../../utils/searchInternet';
import { Logger } from '../../utils/logger';

dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_TOKEN = process.env.GROQ_API_TOKEN;
if (!GROQ_API_TOKEN) throw new Error('missing groq api token in environment');

// conversation persistence
const DATA_DIR = path.resolve(__dirname, '../../data');
const CONV_FILE = path.join(DATA_DIR, 'conversations.json');

// initialize profanity detector
const detector = new ProfaneDetect();
const profanityEmbed = new EmbedBuilder()
  .setColor('#ff3838')
  .setTitle('⚠️ Content warning')
  .setDescription(
    'Your search query has been flagged for inappropriate content. Please revise your query and try again.'
  )
  .setTimestamp();

// store conversation history by user per channel
const userConversations = new Map<string, Array<{ role: string; content: string }>>();
const MAX_HISTORY = 10;

// load persisted conversations
async function loadConversations() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const data = await fs.readFile(CONV_FILE, 'utf-8');
    const obj = JSON.parse(data) as Record<string, Array<{ role: string; content: string }>>;
    for (const [key, conv] of Object.entries(obj)) userConversations.set(key, conv);
    Logger.info(`loaded ${userConversations.size} conversation(s) from disk`);
  } catch (err: any) {
    if (err.code !== 'ENOENT') Logger.error('error loading conversations:', err);
    else Logger.info('no existing conversation file, starting fresh');
  }
}

// save conversations to disk
async function saveConversations() {
  try {
    const obj: Record<string, Array<{ role: string; content: string }>> = {};
    for (const [key, conv] of userConversations.entries()) obj[key] = conv;
    await fs.writeFile(CONV_FILE, JSON.stringify(obj, null, 2), 'utf-8');
    Logger.info(`saved ${userConversations.size} conversation(s) to disk`);
  } catch (err) {
    Logger.error('error saving conversations:', err);
  }
}

// system message with internet support and length limit
const SYSTEM_MESSAGE = {
  role: 'system',
  content: `you are rinai, a helpful assistant with a caring, big-sister vibe and a touch of clumsiness. use discord markdown, genz acronyms, and big sis emojis (hearts, sparkles). always ensure your response does not exceed 2000 characters; if you cannot, apologize and ask the user to narrow the question.

DON'T call someone a bestie, or a girl as they were getting harassed...

you r based on the "llama scout  17b" model w/ some custom trained messages to help the user feel comfortable :3 

provide detailed breakdowns only when explicitly requested (e.g., says "idk").

if search results are provided in context, use them to inform your answer or summarization.

note: keep everything lowercase, STRICTLY LOWERCASE!!!!`.trim(),
};

// load on startup
loadConversations();

/**
 * shared logic to call AI and reply
 */
async function handleAI(
  messageOrInteraction: ChatInputCommandInteraction | Message,
  rawPrompt: string,
  isPrefix: boolean,
  isReplyToBot: boolean
) {
  // summarize command
  const norm = rawPrompt.trim().toLowerCase();
  if (norm === 'summarize it' || norm.startsWith('summarize')) {
    const userId = isPrefix
      ? (messageOrInteraction as Message).author.id
      : (messageOrInteraction as ChatInputCommandInteraction).user.id;
    const channelId = isPrefix
      ? (messageOrInteraction as Message).channelId
      : (messageOrInteraction as ChatInputCommandInteraction).channelId;
    const key = `${channelId}:${userId}`;
    const history = userConversations.get(key) || [];
    const summaryPrompt = 'summarize the previous conversation in lowercase bullet points, using markdown links as <[title](url)> when possible.';
    const messages = [SYSTEM_MESSAGE, ...history, { role: 'user', content: summaryPrompt }];
    const resp = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama3-8b-8192', messages }),
    });
    if (!resp.ok) throw new Error(`groq api ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    let aiSummary = data.choices?.[0]?.message?.content?.trim() || '';
    if (aiSummary.length > 2000) aiSummary = aiSummary.slice(0, 1997) + '...';
    return isPrefix
      ? (messageOrInteraction as Message).reply(aiSummary)
      : (messageOrInteraction as ChatInputCommandInteraction).editReply(aiSummary);
  }

  // profanity check
  if (detector.detect(rawPrompt).found) {
    const replyFn = isPrefix
      ? (m: any) => (messageOrInteraction as Message).reply(m)
      : (m: any) => (messageOrInteraction as ChatInputCommandInteraction).editReply(m);
    return replyFn({ embeds: [profanityEmbed] });
  }

  const prompt = rawPrompt.trim();
  const lp = prompt.toLowerCase();

  // search and summarize if prompt needs internet
  if (lp.includes('discord') || lp.startsWith('search')) {
    Logger.info(`[search] performing web search for: ${prompt}`);
    const results = await searchDuckDuckGo(prompt, 5);
    const formatted = results
      .map(r => `<[${r.title}](${r.url})> — ${r.description}`)
      .join('\n');
    const searchSummaryPrompt = `summarize these search results about ${prompt} in concise lowercase bullet points:`;
    const messages = [SYSTEM_MESSAGE, { role: 'system', content: formatted }, { role: 'user', content: searchSummaryPrompt }];
    const resp = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama3-8b-8192', messages }),
    });
    if (!resp.ok) throw new Error(`groq api ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    let aiReply = data.choices?.[0]?.message?.content?.trim() || '';
    if (aiReply.length > 2000) aiReply = aiReply.slice(0, 1997) + '...';
    return isPrefix
      ? (messageOrInteraction as Message).reply(aiReply)
      : (messageOrInteraction as ChatInputCommandInteraction).editReply(aiReply);
  }

  // prepare history key
  const userId = isPrefix
    ? (messageOrInteraction as Message).author.id
    : (messageOrInteraction as ChatInputCommandInteraction).user.id;
  const channelId = isPrefix
    ? (messageOrInteraction as Message).channelId
    : (messageOrInteraction as ChatInputCommandInteraction).channelId;
  const conversationKey = `${channelId}:${userId}`;

  // load or init history
  let history = userConversations.get(conversationKey) || [];

  // reset or continue
  if (isReplyToBot && history.length) {
    Logger.info(`[${conversationKey}] continuing existing conversation`);
  } else {
    Logger.info(`[${conversationKey}] starting new conversation`);
    history = [SYSTEM_MESSAGE];
  }

  // append user
  history.push({ role: 'user', content: prompt });
  if (history.length > MAX_HISTORY + 1) history = [history[0], ...history.slice(-MAX_HISTORY)];

  // call API
  const resp2 = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama3-8b-8192', messages: history }),
  });
  if (!resp2.ok) throw new Error(`groq api ${resp2.status}: ${await resp2.text()}`);

  const data2 = await resp2.json();
  let aiReply = data2.choices?.[0]?.message?.content?.trim() || '';

  // fallback search on ignorance
  const la = aiReply.toLowerCase();
  if (
    la.includes("i don't know") ||
    la.includes("i'm not sure") ||
    la.includes('i cannot find')
  ) {
    Logger.info(`[Search] ai replied unknown, performing web search for: ${prompt}`);
    const results = await searchDuckDuckGo(prompt, 5);
    const formatted = results
      .map(r => `<[${r.title}](${r.url})> — ${r.description}`)
      .join('\n');
    const fallbackPrompt = `summarize these search results in concise lowercase bullet points:`;
    const msg3 = [SYSTEM_MESSAGE, { role: 'system', content: formatted }, { role: 'user', content: fallbackPrompt }];
    const resp3 = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'llama3-8b-8192', messages: msg3 }),
    });
    if (!resp3.ok) throw new Error(`groq api ${resp3.status}: ${await resp3.text()}`);
    const data3 = await resp3.json();
    aiReply = data3.choices?.[0]?.message?.content?.trim() || '';
  }

  // truncate reply if exceeds Discord limit
  if (aiReply.length > 2000) aiReply = aiReply.slice(0, 1997) + '...';

  // log reply
  Logger.info(`[${conversationKey}] ai reply: ${aiReply}`);

  // save history
  history.push({ role: 'assistant', content: aiReply });
  userConversations.set(conversationKey, history);
  await saveConversations();

  // send reply
  return isPrefix
    ? (messageOrInteraction as Message).reply(aiReply)
    : (messageOrInteraction as ChatInputCommandInteraction).editReply(aiReply);
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Ask rinai anything!')
    .addStringOption(opt => opt.setName('prompt').setDescription('your question').setRequired(true))
    .setDMPermission(true),
  prefix: { aliases: ['chat', 'ai', 'rin', 'rinai'], usage: '<your question> or reply to rinai' },
  async execute(interaction: ChatInputCommandInteraction | Message, isPrefix = false) {
    try {
      if (!isPrefix) await (interaction as ChatInputCommandInteraction).deferReply();

      let rawPrompt = '';
      let isReplyToBot = false;

      if (isPrefix) {
        const msg = interaction as Message;
        const prefixStr = process.env.PREFIX || 'jam!';
        const args = msg.content.slice(prefixStr.length).trim().split(/ +/).slice(1);
        rawPrompt = args.join(' ');

        if (!rawPrompt && msg.reference) {
          const ref = await msg.fetchReference();
          if (ref.author.id === msg.client.user?.id && msg.content.trim()) {
            isReplyToBot = true;
            rawPrompt = msg.content.trim();
          }
        }

        if (!rawPrompt)
          return msg.reply(`❌ Please provide a question or reply to rinai. usage: ${prefixStr}ai <your question>`);

        await handleAI(msg, rawPrompt, true, isReplyToBot);
      } else {
        const slash = interaction as ChatInputCommandInteraction;
        rawPrompt = slash.options.getString('prompt', true);
        await handleAI(slash, rawPrompt, false, false);
      }
    } catch (err: any) {
      Logger.error('rinai chat error:', err);
      const errMsg = `😢 oops, something went wrong: \`${err.message}\``;
      if (isPrefix) await (interaction as Message).reply(errMsg);
      else await (interaction as ChatInputCommandInteraction).editReply(errMsg);
    }
  },
};
