import {
  ChatInputCommandInteraction,
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
  (user: string, target: string) =>
    `**${user}** shares a moment of pure affection with **${target}**!`,
  (user: string, target: string) =>
    `aww, **${user}** gives **${target}** the most loving kiss ever!`,
  (user: string, target: string) =>
    `**${user}** expresses their feelings with a sweet kiss for **${target}**!`,
  (user: string, target: string) =>
    `**${target}** receives a heartwarming kiss from **${user}**!`,
  (user: string, target: string) =>
    `**${user}** steals a tender moment with **${target}**!`,
  (user: string, target: string) =>
    `how romantic! **${user}** kisses **${target}** sweetly!`,
  (user: string, target: string) =>
    `**${user}** can't help but share a magical kiss with **${target}**!`,
  (user: string, target: string) =>
    `sparks fly as **${user}** gives **${target}** a loving kiss!`,
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

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow kissing yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                `❌ Kisses are meant to be shared! Save them for someone special! ${getRandomKaomoji()}`,
              )
              .setFooter({
                text: "Share your affection with others instead! 💝",
              }),
          ],
        });
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("kiss"),
        Promise.resolve(
          getRandomMessage(
            kissMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#ff69b4") // Hot pink for romantic kisses!
        .setTitle(`${topDecorations} Sweet Kiss Time! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading love and affection! ${getRandomKaomoji()}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Kiss command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              `❌ The kiss got lost in a shower of sparkles... Try again! ${getRandomKaomoji()}`,
            ),
        ],
      });
    }
  },
};
