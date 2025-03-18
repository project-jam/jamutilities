import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif } from "../../utils/otakuGifs";

// Dance emoticons for variety
const danceEmotes = [
  "💃",
  "🕺",
  "💫",
  "✨",
  "🌟",
  "⭐",
  "🎵",
  "🎶",
  "🎊",
  "🎉",
  "🪩",
  "🔥",
  "⚡",
  "🌈",
  "🦋",
  "🎭",
  "🎪",
  "🎨",
  "🎡",
  "💝",
];

// Regular dance messages
const danceMessages = [
  (user: string, target: string) =>
    `**${user}** and **${target}** light up the dance floor with their incredible moves! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `The rhythm is contagious as **${user}** and **${target}** groove together! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `Watch out! **${user}** and **${target}** are turning this into a party zone! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `When **${user}** meets **${target}**, the dance floor becomes electric! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** and **${target}** create pure magic with their dance moves! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `The spotlight shines on **${user}** and **${target}** as they dance the night away! ${getRandomEmote()}`,
];

// Solo dance messages
const soloDanceMessages = [
  (user: string) =>
    `**${user}** breaks into an incredible solo performance! ${getRandomEmote()}`,
  (user: string) =>
    `All eyes on **${user}** as they dominate the dance floor! ${getRandomEmote()}`,
  (user: string) =>
    `**${user}** unleashes their inner dancing star! ${getRandomEmote()}`,
  (user: string) =>
    `Watch in awe as **${user}** shows off their amazing moves! ${getRandomEmote()}`,
  (user: string) =>
    `**${user}** creates pure dance magic all by themselves! ${getRandomEmote()}`,
  (user: string) =>
    `The spotlight belongs to **${user}** as they dance their heart out! ${getRandomEmote()}`,
];

// Helper functions for random elements
function getRandomEmote(): string {
  return danceEmotes[Math.floor(Math.random() * danceEmotes.length)];
}

function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(() => danceEmotes[Math.floor(Math.random() * danceEmotes.length)])
    .join(" ");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("dance")
    .setDescription("Start a groovy dance adventure! 💃✨")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Someone to dance with (optional)")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["dance", "groove", "party"],
    usage: "@user",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      if (isPrefix) {
        // Handle prefix command
        const message = interaction as Message;
        const target = message.mentions.users.first();
        const user = message.author;

        const [gifUrl] = await Promise.all([getGif("dance")]);
        const topDecorations = getRandomDecorations(3);
        const bottomDecorations = getRandomDecorations(3);

        const embed = new EmbedBuilder()
          .setColor("#FF69B4")
          .setTitle(`${topDecorations} Dance Time! ${topDecorations}`);

        if (!target || target.id === user.id) {
          // Solo dance
          const soloMessage = soloDanceMessages[
            Math.floor(Math.random() * soloDanceMessages.length)
          ](user.toString());
          embed.setDescription(`${soloMessage}\n\n${bottomDecorations}`);
        } else {
          // Partner dance
          const danceMessage = danceMessages[
            Math.floor(Math.random() * danceMessages.length)
          ](user.toString(), target.toString());
          embed.setDescription(`${danceMessage}\n\n${bottomDecorations}`);
        }

        embed
          .setImage(gifUrl)
          .setFooter({
            text: `Getting groovy! ${getRandomEmote()}`,
            iconURL: user.displayAvatarURL(),
          })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        // Handle slash command
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();

        const target = slashInteraction.options.getUser("user");
        const user = slashInteraction.user;

        const [gifUrl] = await Promise.all([getGif("dance")]);
        const topDecorations = getRandomDecorations(3);
        const bottomDecorations = getRandomDecorations(3);

        const embed = new EmbedBuilder()
          .setColor("#FF69B4")
          .setTitle(`${topDecorations} Dance Time! ${topDecorations}`);

        if (!target || target.id === user.id) {
          // Solo dance
          const soloMessage = soloDanceMessages[
            Math.floor(Math.random() * soloDanceMessages.length)
          ](user.toString());
          embed.setDescription(`${soloMessage}\n\n${bottomDecorations}`);
        } else {
          // Partner dance
          const danceMessage = danceMessages[
            Math.floor(Math.random() * danceMessages.length)
          ](user.toString(), target.toString());
          embed.setDescription(`${danceMessage}\n\n${bottomDecorations}`);
        }

        embed
          .setImage(gifUrl)
          .setFooter({
            text: `Getting groovy! ${getRandomEmote()}`,
            iconURL: user.displayAvatarURL(),
          })
          .setTimestamp();

        await slashInteraction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      Logger.error("Dance command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The dance floor got too wild! Try again! ${getRandomEmote()}`,
        );

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
