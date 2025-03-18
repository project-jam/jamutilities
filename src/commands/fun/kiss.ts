import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Sweet decorative elements
const kissDecorations = [
  "💋",
  "💝",
  "💖",
  "💕",
  "💗",
  "💓",
  "💞",
  "💘",
  "💟",
  "♥️",
  "🌸",
  "✨",
  "💫",
  "🌟",
  "⭐",
  "🎀",
  "🌺",
  "🫶",
  "😘",
  "💌",
];

// Romantic kaomoji
const loveKaomoji = [
  "(´∀｀)♡",
  "(◕‿◕)♡",
  "(♡˙︶˙♡)",
  "♡(◡‿◡✿)",
  "(◕‿◕)♡",
  "(｡♥‿♥｡)",
  "(●´∀｀)♡",
  "( ˘ ³˘)♡",
  "(´｡• ᵕ •｡`) ♡",
  "(♡ω♡)",
  "( ◜‿◝ )♡",
  "(´• ω •`) ♡",
];

// Enhanced kiss messages with more romance
const kissMessages = [
  (user: string, target: string) =>
    `ooh~ **${user}** gives **${target}** a sweet, magical kiss!`,
  (user: string, target: string) =>
    `**${user}** plants the most precious kiss on **${target}**!`,
  // ... rest of your kiss messages ...
];

// Helper functions for random elements
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => kissDecorations[Math.floor(Math.random() * kissDecorations.length)],
    )
    .join(" ");
}

function getRandomKaomoji(): string {
  return loveKaomoji[Math.floor(Math.random() * loveKaomoji.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("kiss")
    .setDescription("Share a sweet kiss! 💋✨")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The person to share a magical kiss with")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["kiss", "smooch", "chu"], // Include base command name in aliases
    usage: "@user",
  },

  async execute(
    context: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    if (!isPrefix) {
      await (context as ChatInputCommandInteraction).deferReply();
    }

    try {
      const target = isPrefix
        ? (context as Message).mentions.users.first()
        : (context as ChatInputCommandInteraction).options.getUser("user");

      const user = isPrefix
        ? (context as Message).author
        : (context as ChatInputCommandInteraction).user;

      if (!target) {
        const prefix = process.env.PREFIX || "jam!";
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Please mention someone to kiss!")
          .addFields({
            name: "Usage",
            value: isPrefix
              ? `${prefix}kiss @user\n${prefix}smooch @user\n${prefix}chu @user`
              : `/kiss user:@user`,
          });

        if (isPrefix) {
          await (context as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (context as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      // Don't allow kissing yourself
      if (target.id === user.id) {
        const selfKissEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ Kisses are meant to be shared! Save them for someone special! ${getRandomKaomoji()}`,
          )
          .setFooter({
            text: "Share your affection with others instead! 💝",
          });

        if (isPrefix) {
          await (context as Message).reply({ embeds: [selfKissEmbed] });
        } else {
          await (context as ChatInputCommandInteraction).editReply({
            embeds: [selfKissEmbed],
          });
        }
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("kiss"),
        Promise.resolve(
          getRandomMessage(kissMessages, user.toString(), target.toString()),
        ),
      ]);

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#ff69b4")
        .setTitle(`${topDecorations} Sweet Kiss Time! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading love and affection! ${getRandomKaomoji()}`,
          iconURL: user.displayAvatarURL(),
        })
        .setTimestamp();

      if (isPrefix) {
        await (context as Message).reply({ embeds: [embed] });
      } else {
        await (context as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Kiss command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The kiss got lost in a shower of sparkles... Try again! ${getRandomKaomoji()}`,
        );

      if (isPrefix) {
        await (context as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (context as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
