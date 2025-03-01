import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Wholesome decorative elements
const hugDecorations = [
  "🤗",
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
  "🌷",
  "🌹",
  "🍀",
];

// Cute kaomoji for hugs
const hugKaomoji = [
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

// Enhanced hug messages with more warmth
const hugMessages = [
  (user: string, target: string) =>
    `aww, **${user}** gives **${target}** the warmest, coziest hug ever!`,
  (user: string, target: string) =>
    `**${user}** wraps **${target}** in the most heartwarming embrace!`,
  (user: string, target: string) =>
    `**${user}** pulls **${target}** in for a big, loving hug!`,
  (user: string, target: string) =>
    `**${target}** receives the most wholesome hug from **${user}**!`,
  (user: string, target: string) =>
    `**${user}** shares pure happiness with **${target}** through a hug!`,
  (user: string, target: string) =>
    `look how precious! **${user}** gives **${target}** the sweetest hug!`,
  (user: string, target: string) =>
    `**${user}** spreads love and joy by hugging **${target}**!`,
  (user: string, target: string) =>
    `**${target}** gets enveloped in the most wonderful hug from **${user}**!`,
  (user: string, target: string) =>
    `**${user}** shares a magical moment of pure affection with **${target}**!`,
  (user: string, target: string) =>
    `**${user}** embraces **${target}** with all the warmth in the world!`,
];

// Helper functions for random elements
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => hugDecorations[Math.floor(Math.random() * hugDecorations.length)],
    )
    .join(" ");
}

function getRandomKaomoji(): string {
  return hugKaomoji[Math.floor(Math.random() * hugKaomoji.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("hug")
    .setDescription("Share some heartwarming hugs! 🤗💝")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The person to share warm hugs with")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow hugging yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                `❌ Aww, need a hug? Share your warmth with others instead! ${getRandomKaomoji()}`,
              )
              .setFooter({
                text: "Hugs are meant to be shared with friends! 💝",
              }),
          ],
        });
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("hug"),
        Promise.resolve(
          getRandomMessage(
            hugMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#ffd1dc") // Light pink for wholesome hugs!
        .setTitle(`${topDecorations} Warm Hugs Time! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading warmth and happiness! ${getRandomKaomoji()}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Hug command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              `❌ The hug got lost in a cloud of sparkles... Try again! ${getRandomKaomoji()}`,
            ),
        ],
      });
    }
  },
};
