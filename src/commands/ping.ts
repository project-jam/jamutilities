import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/Command';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
    
  async execute(interaction: ChatInputCommandInteraction) {
    const start = Date.now();
    await interaction.reply('Pinging...');
    
    const latency = Date.now() - start;
    const apiLatency = Math.round(interaction.client.ws.ping);
    
    await interaction.editReply(
      `🏓 Pong!\n` +
      `Bot Latency: \`${latency}ms\`\n` +
      `API Latency: \`${apiLatency}ms\``
    );
  },
};
