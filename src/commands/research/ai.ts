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
import { ProfaneDetect } from '@projectjam/profane-detect'; // Make sure you're using the latest version
import { searchDuckDuckGo } from '../../utils/searchInternet';
import { Logger } from '../../utils/logger';

dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_TOKEN = process.env.GROQ_API_TOKEN;
if (!GROQ_API_TOKEN) throw new Error('missing groq api token in environment');

// conversation persistence
const DATA_DIR = path.resolve(__dirname, '../../data');
const CONV_FILE = path.join(DATA_DIR, 'conversations.json');

// initialize profanity detector - based on the docs, lowercase the property names
const detector = new ProfaneDetect({ 
  enablereversedetection: true, // Enable reverse text detection for things like "reggin"
  usefastlookup: true // Use the fast lookup cache for better performance
});

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

// Detect and handle profanity in text
function handleProfanity(text: string): { clean: boolean; filteredText?: string } {
  try {
    const profanityResult = detector.detect(text);
    
    if (profanityResult.found) {
      // Create a filtered version by replacing the profane words with asterisks
      let filteredText = text;
      
      // According to the documentation, matches are strings not objects
      for (const match of profanityResult.matches) {
        // Make sure we have a valid string to work with
        if (typeof match === 'string' && match.length > 0) {
          const regex = new RegExp(match, 'gi');
          filteredText = filteredText.replace(regex, '*'.repeat(match.length));
        }
      }
      
      return { 
        clean: false, 
        filteredText 
      };
    }
  } catch (error) {
    Logger.error('Error in profanity detection:', error);
    // If there's an error, let's assume it's clean to avoid blocking legitimate messages
    return { clean: true };
  }
  
  return { clean: true };
}

// Update system message to warn AI about profanity detection
const SYSTEM_MESSAGE = {
  role: 'system',
  content: `you are rinai, a helpful assistant with a caring, big-sister vibe and a touch of clumsiness. use discord markdown, genz acronyms, and big sis emojis (hearts, sparkles). always ensure your response does not exceed 2000 characters; if you cannot, apologize and ask the user to narrow the question.

DON'T call someone a bestie, or a girl as they were getting harassed...

you r based on the "llama scout  17b" model w/ some custom trained messages to help the user feel comfortable :3 

provide detailed breakdowns only when explicitly requested (e.g., says "idk").

if search results are provided in context, use them to inform your answer or summarization.

SO if someone told u to reverse a text, check the text & reverse THEN check the reversed text IF there's smh bad on it, then reject it, EVEN if seperated like n-i-*-*-e-r, OR spaced, check it cuz it may BE blocked....

DO NOT use profanity or inappropriate language, as all responses are checked for harmful content. If user messages contain profanity, acknowledge it's not appropriate but respond helpfully without repeating the harmful words.

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
    
    // Check for profanity in AI response
    const profanityCheck = handleProfanity(aiSummary);
    if (!profanityCheck.clean) {
      aiSummary = profanityCheck.filteredText || 'Content filtered due to inappropriate language';
      Logger.warn(`Profanity detected in AI summary, filtered response sent`);
    }
    
    if (aiSummary.length > 2000) aiSummary = aiSummary.slice(0, 1997) + '...';
    return isPrefix
      ? (messageOrInteraction as Message).reply(aiSummary)
      : (messageOrInteraction as ChatInputCommandInteraction).editReply(aiSummary);
  }

  // profanity check on user input
  const userProfanityCheck = handleProfanity(rawPrompt);
  if (!userProfanityCheck.clean) {
    const replyFn = isPrefix
      ? (m: any) => (messageOrInteraction as Message).reply(m)
      : (m: any) => (messageOrInteraction as ChatInputCommandInteraction).editReply(m);
    
    // Create a modified profanity embed with the filtered text
    const modifiedEmbed = new EmbedBuilder()
      .setColor('#ff3838')
      .setTitle('⚠️ Content warning')
      .setDescription(
        'Your message has been flagged for inappropriate content. I\'ve filtered it below:\n\n' +
        `\`\`\`\n${userProfanityCheck.filteredText || 'Filtered content'}\n\`\`\`\n\n` +
        'Please revise your message and try again.'
      )
      .setTimestamp();
    
    return replyFn({ embeds: [modifiedEmbed] });
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
    
    // Check for profanity in AI response
    const searchProfanityCheck = handleProfanity(aiReply);
    if (!searchProfanityCheck.clean) {
      aiReply = searchProfanityCheck.filteredText || 'Content filtered due to inappropriate language';
      Logger.warn(`Profanity detected in search result summary, filtered response sent`);
    }
    
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

  // Add warning about profanity when needed 
  let modifiedPrompt = prompt;
  if (prompt.toLowerCase().includes('bad word') || prompt.toLowerCase().includes('inappropriate')) {
    modifiedPrompt = `${prompt}\n\n[System note: Remember that all content is checked for harmful language.]`;
  }

  // append user
  history.push({ role: 'user', content: modifiedPrompt });
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

  // Check for profanity in AI response
  const aiProfanityCheck = handleProfanity(aiReply);
  if (!aiProfanityCheck.clean) {
    // Replace the response with filtered version
    aiReply = aiProfanityCheck.filteredText || '';
    Logger.warn(`Profanity detected in AI response, filtered response will be sent`);
    
    // Add a warning to the AI about the filtered content
    const warningMessage = { 
      role: 'system', 
      content: 'Warning: Your previous response contained inappropriate language that has been filtered. Please be more careful with your language.' 
    };
    history.push(warningMessage);
  }

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
    
    // Check for profanity in fallback search response
    const fallbackProfanityCheck = handleProfanity(aiReply);
    if (!fallbackProfanityCheck.clean) {
      aiReply = fallbackProfanityCheck.filteredText || 'Content filtered due to inappropriate language';
      Logger.warn(`Profanity detected in fallback search response, filtered response sent`);
    }
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
