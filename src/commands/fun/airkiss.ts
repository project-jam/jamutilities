import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Cute heart emoticons for variety
const heartEmotes = [
  "♡",
  "💖",
  "💝",
  "💕",
  "💗",
  "💓",
  "💞",
  "💘",
  "💟",
  "♥️",
  "💌",
  "💫",
  "✨",
  "🌟",
  "⭐",
  "🎀",
  "🌸",
  "🌺",
];

// Array of possible airkiss messages with enhanced formatting
const airkissMessages = [
  (user: string, target: string) =>
    `**${user}** blows a magical kiss through the air to **${target}**`,
  (user: string, target: string) =>
    `**${user}** sends sparkling kisses floating towards **${target}**`,
  (user: string, target: string) =>
    `**${target}** catches a shimmering air kiss from **${user}**`,
  (user: string, target: string) =>
    `**${user}** sends their love dancing through the air to **${target}**`,
  (user: string, target: string) =>
    `a wild enchanted air kiss appears from **${user}** to **${target}**`,
  (user: string, target: string) =>
    `**${user}** throws a glittering kiss, hope **${target}** catches it!`,
  (user: string, target: string) =>
    `**${user}** sends virtual kisses floating like butterflies to **${target}**`,
  (user: string, target: string) =>
    `look out **${target}**! A shower of sparkly kisses from **${user}** is coming your way!`,
  (user: string, target: string) =>
    `**${user}** sends their affection soaring through the air to **${target}**`,
  (user: string, target: string) =>
    `**${target}** receives a magical long-distance kiss from **${user}**`,
];

// Get random heart decorations
function getHeartDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(() => heartEmotes[Math.floor(Math.random() * heartEmotes.length)])
    .join(" ");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("airkiss")
    .setDescription("Blow a magical kiss to someone! 💋💫")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to send an enchanted air kiss to")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["airkiss", "airsmooch", "blowkiss", "flyingkiss", "GETOUT!"], // Only the base command name, no alternatives
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
          .setDescription("❌ Please mention someone to send an air kiss to!")
          .addFields({
            name: "Usage",
            value: isPrefix
              ? command.prefix.aliases
                  .map((alias) => `${prefix}${alias} @user`)
                  .join("\n")
              : `/airkiss user:@user`,
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

      // Don't allow air kissing yourself
      if (target.id === user.id) {
        const selfKissEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            "❌ Sending air kisses to yourself? Save them for someone special!",
          )
          .setFooter({
            text: "Try sharing your affection with others instead! 💝",
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
        getGif("airkiss"),
        Promise.resolve(
          getRandomMessage(airkissMessages, user.toString(), target.toString()),
        ),
      ]);

      // Create decorative borders
      const topHearts = getHeartDecorations(3);
      const bottomHearts = getHeartDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#ffb6c1")
        .setTitle(`${topHearts} Magical Air Kiss ${topHearts}`)
        .setDescription(`${message}\n\n${bottomHearts}`)
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading love and affection! 💫`,
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
      Logger.error("Airkiss command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Oops! Your magical air kiss got lost in a sparkly whirlwind... Try again! ✨",
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
