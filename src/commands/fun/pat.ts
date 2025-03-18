import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Cute decorative elements
const patDecorations = [
  "✨",
  "💝",
  "💫",
  "🌟",
  "⭐",
  "🎀",
  "🌸",
  "💕",
  "🤗",
  "💖",
  "🍀",
  "🌺",
  "🌼",
  "🎇",
  "💫",
  "🌷",
  "🪷",
  "🫰",
  "☘️",
  "🌱",
];

// Adorable kaomoji
const patKaomoji = [
  "(｡･ω･｡)ﾉ♡",
  "(´｡• ᵕ •｡`)",
  "(*￣▽￣)ノ",
  "(・∀・)ノ",
  "(๑˃ᴗ˂)ﻭ",
  "(｀・ω・´)",
  "(๑>◡<๑)",
  "(≧◡≦)",
  "(⌒▽⌒)☆",
  "｡◕‿◕｡",
  "(◠‿◠✿)",
  "(｡♥‿♥｡)",
];

// Enhanced pat messages with more cuteness
const patMessages = [
  (user: string, target: string) =>
    `**${user}** gives **${target}** the gentlest, most caring headpats!`,
  (user: string, target: string) =>
    `**${user}** showers **${target}** with the sweetest pats!`,
  (user: string, target: string) =>
    `**${user}** shares their affection through soft pats for **${target}**!`,
  (user: string, target: string) =>
    `**${target}** receives the most wholesome headpats from **${user}**!`,
  (user: string, target: string) =>
    `**${user}** spreads happiness by patting **${target}**'s head!`,
  (user: string, target: string) =>
    `**${user}** couldn't resist giving **${target}** all the precious pats!`,
  (user: string, target: string) =>
    `**${target}** melts under **${user}**'s tender headpats!`,
  (user: string, target: string) =>
    `aww, **${user}** comforts **${target}** with gentle pats!`,
  (user: string, target: string) =>
    `**${user}** shares encouraging headpats with **${target}**!`,
  (user: string, target: string) =>
    `the world becomes brighter as **${user}** pats **${target}**!`,
];

// Helper functions for random elements
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => patDecorations[Math.floor(Math.random() * patDecorations.length)],
    )
    .join(" ");
}

function getRandomKaomoji(): string {
  return patKaomoji[Math.floor(Math.random() * patKaomoji.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("pat")
    .setDescription("Share gentle headpats! (｡･ω･｡)ﾉ♡")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The person to shower with sweet pats")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["pat", "headpat", "pats"],
    usage: "<@user>", // Example: jam!pat @user
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

        if (!target) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  `❌ Please mention someone to pat! ${getRandomKaomoji()}`,
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!pat @user`")
                    .join("\n"),
                }),
            ],
          });
          return;
        }
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        target = (interaction as ChatInputCommandInteraction).options.getUser(
          "user",
        );
      }

      // Don't allow patting yourself
      if (target.id === user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ Aww, need headpats? Let others share their affection with you! ${getRandomKaomoji()}`,
          )
          .setFooter({
            text: "Headpats are better when shared! 💝",
          });

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      const gifUrl = await getGif("pat");
      const message = getRandomMessage(
        patMessages,
        user.toString(),
        target.toString(),
      );

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1")
        .setTitle(`${topDecorations} Headpat Time! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading comfort and care! ${getRandomKaomoji()}`,
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
      Logger.error("Pat command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The headpats got lost in a cloud of fluff... Try again! ${getRandomKaomoji()}`,
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
