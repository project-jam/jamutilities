import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Cozy emoticons and symbols
const cozyEmotes = [
  "(っ◕‿◕)っ",
  "(づ｡◕‿‿◕｡)づ",
  "(⊃｡•́‿•̀｡)⊃",
  "╰(*´︶`*)╯",
  "(つ≧▽≦)つ",
  "(⊃･ᴥ･)つ",
  "ʕっ•ᴥ•ʔっ",
  "(づ￣ ³￣)づ",
  "⊂(･ω･*⊂)",
  "( ⊃・ω・)⊃",
  "(o´･_･)っ",
  "(⊃｡•́‿•̀｡)⊃",
];

// Warm and cozy decorative elements
const warmDecorations = [
  "🌸",
  "💕",
  "💗",
  "💖",
  "💝",
  "🌺",
  "✨",
  "💫",
  "🌟",
  "⭐",
  "🧸",
  "🎀",
  "🌙",
  "☁️",
  "🌿",
  "🍃",
  "🪴",
  "🤍",
  "💭",
];

// Enhanced cuddle messages with cozy themes
const cuddleMessages = [
  (user: string, target: string) =>
    `**${user}** wraps **${target}** in the warmest, coziest cuddle ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** snuggles up to **${target}** like a warm blanket ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** gives **${target}** the most comforting cuddles ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${target}** receives the softest, warmest cuddles from **${user}** ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** envelops **${target}** in a cozy cuddle cocoon ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** shares the most tender cuddles with **${target}** ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${target}** gets wrapped in **${user}**'s warm, fluffy cuddle ${getRandomEmote()}`,
  (user: string, target: string) =>
    `aww, **${user}** gives **${target}** the gentlest cuddles ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** and **${target}** share the most heartwarming cuddle ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** surrounds **${target}** with pure wholesome cuddles ${getRandomEmote()}`,
];

// Helper functions for random elements
function getRandomEmote(): string {
  return cozyEmotes[Math.floor(Math.random() * cozyEmotes.length)];
}

function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => warmDecorations[Math.floor(Math.random() * warmDecorations.length)],
    )
    .join(" ");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cuddle")
    .setDescription("Share warm and cozy cuddles! (っ◕‿◕)っ 💝")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The person to share cozy cuddles with")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["cuddle", "snuggle", "snug"],
    usage: "@user",
  },

  async execute(
    context: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    // Only defer for slash commands. For safety, we check if the function exists.
    if (
      !isPrefix &&
      typeof (context as ChatInputCommandInteraction).deferReply === "function"
    ) {
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
          .setDescription("❌ Please mention someone to cuddle!")
          .addFields({
            name: "Usage",
            value: `${prefix}cuddle @user\n${prefix}snuggle @user\n${prefix}snug @user`,
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

      // Self-cuddle check
      if (target.id === user.id) {
        const selfEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ You need cuddles? Let others share their warmth with you! ${getRandomEmote()}`,
          )
          .setFooter({ text: "Cuddles are better when shared! 💝" });
        if (isPrefix) {
          await (context as Message).reply({ embeds: [selfEmbed] });
        } else {
          await (context as ChatInputCommandInteraction).editReply({
            embeds: [selfEmbed],
          });
        }
        return;
      }

      // Generate cuddle content
      const [gifUrl, cuddleMessage] = await Promise.all([
        getGif("cuddle"),
        Promise.resolve(
          getRandomMessage(cuddleMessages, user.toString(), target.toString()),
        ),
      ]);

      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1")
        .setTitle(`${topDecorations} Cozy Cuddle Time! ${topDecorations}`)
        .setDescription(`${cuddleMessage}\n\n${bottomDecorations}`)
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading warmth and comfort! ${getRandomEmote()}`,
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
      Logger.error("Cuddle command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The cuddles got lost in a cloud of warmth... Try again! ${getRandomEmote()}`,
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
