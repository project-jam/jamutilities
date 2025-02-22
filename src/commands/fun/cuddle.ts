import {
  ChatInputCommandInteraction,
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

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow cuddling yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                `❌ Aww, need cuddles? Let someone else wrap you in warmth instead! ${getRandomEmote()}`,
              )
              .setFooter({
                text: "Cuddles are better when shared with others! 💝",
              }),
          ],
        });
        return;
      }

      // Get GIF and random message using utility functions
      const [gifUrl, message] = await Promise.all([
        getGif("cuddle"),
        Promise.resolve(
          getRandomMessage(
            cuddleMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1") // Light pink for wholesome cuddles!
        .setTitle(`${topDecorations} Cozy Cuddle Time! ${topDecorations}`)
        .setDescription(`${message}\n\n${bottomDecorations}`)
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading warmth and comfort! ${getRandomEmote()}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Cuddle command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              `❌ The cuddles got lost in a cloud of coziness... Try again! ${getRandomEmote()}`,
            ),
        ],
      });
    }
  },
};
