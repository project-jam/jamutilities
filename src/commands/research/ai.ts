import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from 'discord.js';
import type { Command } from '../../types/Command';
import fetch from 'node-fetch';
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
const userConversations = new Map<string, Array<{role: string, content: string}>>();

// Maximum conversation history length
const MAX_HISTORY = 10;

// System message
const SYSTEM_MESSAGE = {
  role: 'system',
  content: `You are RinAI, or Rin (for genz, it's rinai, or rin), and u r a helpful assistant who acts with a caring, big sister vibe and a touch of clumsiness — but never explicitly say you're clumsy or like a big sister. Use markdowns!!! Use modern genz acronyms (lowercase, 'bestie' is optional) and big sis vibe emojis (hearts, sparkles, etc.). Also DON'T YOU EVER TRY AND MAKE THE MESSAGE A LOT LONGER, LIKE MORE THAN 2000 CHARACTERS! ALSO try & not make ur messages very gay, like very very gay cuz we hate it... And don't try & give out gay results ar anything that's harmful for the community, but you're not homophobic, BUT like respect the user's request without being a homophobic OR try and make something against the rules like every Discord server. Make EVERY question be answered straight-forward, short, and clear, if u need to say like 'yes' or 'no' then do it. AND ONLY give detailed/descriptive answers (like pros & cons or breakdowns) **if the user says to make it descriptive or says something like “idk”**. Also the markdown im talking is the Discord Markdon 101.`.trim(),
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('chat')
    .setDescription('Ask RinAI anything!')
    .addStringOption(opt =>
      opt
        .setName('prompt')
        .setDescription('What do you want to ask RinAI?')
        .setRequired(true)
    )
    .setDMPermission(true),
  prefix: {
    aliases: ['chat', 'ai', 'rin', 'rinai'],
    usage: '<your question here>',
  },
  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false
  ) {
    try {
      // For slash commands, defer the reply
      if (!isPrefix) {
        await (interaction as ChatInputCommandInteraction).deferReply();
      }
      
      // Extract user prompt
      const userPrompt = isPrefix
        ? (interaction as Message).content.trim().split(/\s+/).slice(1).join(' ')
        : (interaction as ChatInputCommandInteraction).options.getString('prompt', true);
      
      // Get user and channel IDs for conversation tracking
      const userId = isPrefix 
        ? (interaction as Message).author.id 
        : (interaction as ChatInputCommandInteraction).user.id;
      
      const channelId = isPrefix
        ? (interaction as Message).channelId
        : (interaction as ChatInputCommandInteraction).channelId;
      
      // Create a unique key for this user's conversation in this channel
      const conversationKey = `${channelId}:${userId}`;
      
      // Check for profanity
      const detection = detector.detect(userPrompt);
      if (detection.found) {
        if (isPrefix) {
          return (interaction as Message).reply({ embeds: [profanityEmbed] });
        } else {
          return (interaction as ChatInputCommandInteraction).editReply({ embeds: [profanityEmbed] });
        }
      }
      
      // Get or initialize conversation history
      let conversationHistory = userConversations.get(conversationKey) || [SYSTEM_MESSAGE];
      
      // Check if this is a reply to a bot message
      let isReplyToBot = false;
      if (isPrefix && (interaction as Message).reference) {
        try {
          const referencedMessage = await (interaction as Message).fetchReference();
          if (referencedMessage.author.id === interaction.client.user?.id) {
            isReplyToBot = true;
          }
        } catch (error) {
          console.error('Error fetching referenced message:', error);
        }
      }
      
      // If not replying to the bot and we have history, start a new conversation
      if (!isReplyToBot && conversationHistory.length > 1) {
        conversationHistory = [SYSTEM_MESSAGE];
      }
      
      // Add user message to history
      conversationHistory.push({ role: 'user', content: userPrompt });
      
      // Trim history if needed
      if (conversationHistory.length > MAX_HISTORY + 1) {
        conversationHistory = [
          conversationHistory[0],
          ...conversationHistory.slice(-(MAX_HISTORY))
        ];
      }
      
      // Call the GROQ API
      const resp = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama3-8b-8192',
          messages: conversationHistory,
        }),
      });
      
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`GROQ API ${resp.status}: ${errText}`);
      }
      
      const data = await resp.json();
      const aiContent = data.choices?.[0]?.message?.content?.trim();
      
      if (!aiContent) {
        throw new Error('Empty response from GROQ API');
      }
      
      // Add AI response to history
      conversationHistory.push({ role: 'assistant', content: aiContent });
      
      // Save updated conversation
      userConversations.set(conversationKey, conversationHistory);
      
      // Send the response
      if (isPrefix) {
        await (interaction as Message).reply(aiContent);
      } else {
        await (interaction as ChatInputCommandInteraction).editReply(aiContent);
      }
      
    } catch (err: any) {
      console.error('RinAI chat error:', err);
      const errorMessage = `😢 Oops, something went wrong: \`${err.message}\``;
      
      if (isPrefix) {
        await (interaction as Message).reply(errorMessage);
      } else {
        await (interaction as ChatInputCommandInteraction).editReply(errorMessage);
      }
    }
  },
};

