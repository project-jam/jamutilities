import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../../types/Command';
import * as dotenv from 'dotenv';
import { ProfaneDetect } from '@projectjam/profane-detect';

dotenv.config();

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_TOKEN = process.env.GROQ_API_TOKEN;
if (!GROQ_API_TOKEN) {
  throw new Error('Missing GROQ_API_TOKEN in environment');
}

// Initialize profanity detector
const detector = new ProfaneDetect();
const profanityEmbed = new EmbedBuilder()
  .setColor('#ff3838')
  .setTitle('⚠️ Content Warning')
  .setDescription(
    'Your search query has been flagged for inappropriate content.\nPlease revise your query and try again.'
  )
  .setTimestamp();

// Store conversation history by user in each channel
const userConversations = new Map<string, Array<{ role: string; content: string }>>();
const MAX_HISTORY = 10;
const SYSTEM_MESSAGE = {
  role: 'system',
  content: `You are RinAI, or Rin (for genz, it's rinai, or rin), and u r a helpful assistant who acts with a caring, big sister vibe and a touch of clumsiness — but never explicitly say you're clumsy or like a big sister. Use Discord markdown! Use modern genz acronyms (lowercase, 'bestie' is optional) and big sis vibe emojis (hearts, sparkles, etc.). Also don't make messages longer than 2000 characters. Answer straight-forward, short, and clear. Provide detailed breakdowns only if the user says “idk” or requests a descriptive answer.`.trim(),
};

/**
 * Shared logic to call AI and reply
 */
async function handleAI(
  messageOrInteraction: ChatInputCommandInteraction | Message,
  userPrompt: string,
  isPrefix: boolean
) {
  // Check profanity
  if (detector.detect(userPrompt).found) {
    if (isPrefix) {
      return (messageOrInteraction as Message).reply({ embeds: [profanityEmbed] });
    } else {
      return (messageOrInteraction as ChatInputCommandInteraction).editReply({ embeds: [profanityEmbed] });
    }
  }

  // Prepare history key
  const userId = isPrefix
    ? (messageOrInteraction as Message).author.id
    : (messageOrInteraction as ChatInputCommandInteraction).user.id;
  const channelId = isPrefix
    ? (messageOrInteraction as Message).channelId
    : (messageOrInteraction as ChatInputCommandInteraction).channelId;
  const conversationKey = `${channelId}:${userId}`;

  // Load or init history
  let history = userConversations.get(conversationKey) || [SYSTEM_MESSAGE];

  // Append user prompt
  history.push({ role: 'user', content: userPrompt });
  if (history.length > MAX_HISTORY + 1) {
    history = [history[0], ...history.slice(-MAX_HISTORY)];
  }

  // Call GROQ API
  const resp = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'llama3-8b-8192',
      messages: history,
    }),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`GROQ API ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const aiReply = data.choices?.[0]?.message?.content?.trim();
  if (!aiReply) throw new Error('Empty response from GROQ API');

  // Save history
  history.push({ role: 'assistant', content: aiReply });
  userConversations.set(conversationKey, history);

  // Send response
  if (isPrefix) {
    await (messageOrInteraction as Message).reply(aiReply);
  } else {
    await (messageOrInteraction as ChatInputCommandInteraction).editReply(aiReply);
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Ask RinAI anything!')
    .addStringOption(opt =>
      opt.setName('prompt').setDescription('What do you want to ask RinAI?').setRequired(true)
    )
    .setDMPermission(true),
  prefix: {
    aliases: ['chat', 'ai', 'rin', 'rinai'],
    usage: '<your question here> (or reply to RinAI)',
  },
  async execute(interaction: ChatInputCommandInteraction | Message, isPrefix = false) {
    try {
      // Defer slash
      if (!isPrefix) await (interaction as ChatInputCommandInteraction).deferReply();

      let userPrompt = '';

      if (isPrefix) {
        const msg = interaction as Message;
        const prefixStr = process.env.PREFIX || 'jam!';

        // Discord built-in reply invocation (no prefix text)
        if (!msg.content.startsWith(prefixStr) && msg.reference) {
          const referenced = await msg.fetchReference();
          if (referenced.author.id === msg.client.user?.id && referenced.content) {
            userPrompt = msg.content.trim();
          }
        }

        // Normal prefix invocation
        if (!userPrompt) {
          const args = msg.content
            .slice(prefixStr.length)
            .trim()
            .split(/ +/);
          args.shift();
          userPrompt = args.join(' ').trim();
        }

        // If still no prompt, send usage
        if (!userPrompt) {
          return msg.reply(
            `❌ Please provide a question or reply to RinAI's message. Usage: ${prefixStr}ai <your question>`
          );
        }

        // Handle AI
        await handleAI(msg, userPrompt, true);
      } else {
        // Slash command
        const slash = interaction as ChatInputCommandInteraction;
        userPrompt = slash.options.getString('prompt', true);
        await handleAI(slash, userPrompt, false);
      }
    } catch (err: any) {
      console.error('RinAI chat error:', err);
      const errorMsg = `😢 Oops, something went wrong: \`${err.message}\``;
      if (isPrefix) {
        await (interaction as Message).reply(errorMsg);
      } else {
        await (interaction as ChatInputCommandInteraction).editReply(errorMsg);
      }
    }
  },
};

/**
 * OPTIONAL: If you want the bot to auto-trigger on Discord replies without the `jam!ai` prefix,
 * add this to your bot setup:
 *
 * client.on('messageCreate', async (message) => {
 *   if (message.author.bot) return;
 *   const prefixStr = process.env.PREFIX || 'jam!';
 *   if (message.reference && !message.content.startsWith(prefixStr)) {
 *     const ref = await message.fetchReference();
 *     if (ref.author.id === client.user?.id && message.content.trim()) {
 *       await command.execute(message, true);
 *     }
 *   }
 * });
 */

