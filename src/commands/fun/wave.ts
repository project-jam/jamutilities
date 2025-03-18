import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Friendly decorative elements
const waveDecorations = [
  "👋",
  "✨",
  "💫",
  "🌟",
  "⭐",
  "🎈",
  "💝",
  "💖",
  "🌸",
  "🎀",
  "🌺",
  "🌼",
  "🌻",
  "☀️",
  "🌈",
  "🦋",
  "🕊️",
  "💐",
  "🍀",
  "💕",
];

// Happy kaomoji
const waveKaomoji = [
  "(｡･ω･)ﾉﾞ",
  "(◕‿◕)ﾉ",
  "(｡♥‿♥｡)",
  "(ﾉ´ヮ`)ﾉ*: ･ﾟ",
  "(*・ω・)ﾉ",
  "(￣▽￣)ノ",
  "(●´∀｀●)ﾉ",
  "(〃･ω･)ﾉ~☆",
  "ヾ(･ω･*)ﾉ",
  "(＾▽＾)ノ",
  "ヾ(＾-＾)ノ",
  "╰(*°▽°*)╯",
];

// Messages for solo waving (no target)
const soloMessages = [
  (user: string) => `**${user}** waves cheerfully to everyone!`,
  (user: string) => `**${user}** spreads joy with a friendly wave!`,
  (user: string) => `**${user}** waves hello to the whole world!`,
  (user: string) => `**${user}** shares their happiness with a wave!`,
  (user: string) => `Look! **${user}** is waving at everyone!`,
  (user: string) => `**${user}** brightens the day with a wave!`,
  (user: string) => `**${user}** sends their greetings to all!`,
  (user: string) => `**${user}** waves with boundless enthusiasm!`,
];

// Messages for waving at others
const waveMessages = [
  (user: string, target: string) =>
    `**${user}** sends the friendliest wave to **${target}**!`,
  (user: string, target: string) =>
    `**${user}** greets **${target}** with a super cheerful wave!`,
  (user: string, target: string) =>
    `**${user}** brightens **${target}**'s day with a wave!`,
  (user: string, target: string) =>
    `**${user}** waves excitedly at **${target}**!`,
  (user: string, target: string) =>
    `hey **${target}**! **${user}** sends you the happiest wave!`,
  (user: string, target: string) =>
    `**${user}** shares a moment of joy waving at **${target}**!`,
  (user: string, target: string) =>
    `**${target}** receives the most wholesome wave from **${user}**!`,
  (user: string, target: string) =>
    `**${user}** spreads happiness by waving at **${target}**!`,
];

// Helper functions for random elements
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => waveDecorations[Math.floor(Math.random() * waveDecorations.length)],
    )
    .join(" ");
}

function getRandomKaomoji(): string {
  return waveKaomoji[Math.floor(Math.random() * waveKaomoji.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("wave")
    .setDescription("Share a friendly wave! (｡･ω･)ﾉﾞ")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Someone to wave at (optional)")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["wave", "hi", "hello"],
    usage: "[@user]", // Example: jam!wave [@user]
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let target;
      const user = isPrefix
        ? (interaction as Message).author
        : (interaction as ChatInputCommandInteraction).user;

      if (isPrefix) {
        const message = interaction as Message;
        await message.channel.sendTyping();
        target = message.mentions.users.first();
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        target = (interaction as ChatInputCommandInteraction).options.getUser(
          "user",
        );
      }

      const gifUrl = await getGif("wave");

      let message: string;
      if (!target) {
        // Solo wave to everyone!
        message = soloMessages[Math.floor(Math.random() * soloMessages.length)](
          user.toString(),
        );
      } else {
        // Wave to specific person
        message = getRandomMessage(
          waveMessages,
          user.toString(),
          target.toString(),
        );
      }

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#87CEEB")
        .setTitle(`${topDecorations} Happy Wave Time! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading joy one wave at a time! ${getRandomKaomoji()}`,
          iconURL: user.displayAvatarURL(),
        })
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Wave command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ Your wave got tangled in happiness! Try again! ${getRandomKaomoji()}`,
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
