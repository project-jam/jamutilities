import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Array of possible nom messages with food themes
const nomMessages = [
  (user: string, target: string) =>
    `**${user}** shares a delicious snack with **${target}** nom nom! 🍪`,
  (user: string, target: string) =>
    `**${user}** and **${target}** have a cute food moment! 🍡`,
  (user: string, target: string) =>
    `**${target}** gets offered a tasty treat by **${user}**! 🍰`,
  (user: string, target: string) =>
    `nom nom! **${user}** feeds **${target}** something yummy! 🍙`,
  (user: string, target: string) =>
    `**${user}** and **${target}** enjoy snack time together! 🍩`,
  (user: string, target: string) =>
    `**${target}** happily accepts a bite of food from **${user}**! 🍫`,
  (user: string, target: string) =>
    `munch munch! **${user}** shares their favorite snack with **${target}**! 🍬`,
  (user: string, target: string) =>
    `**${user}** starts a cute eating session with **${target}**! 🍥`,
  (user: string, target: string) =>
    `**${target}** can't resist the yummy food **${user}** is sharing! 🍡`,
];

// Special messages for self-nom
const selfNomMessages = [
  (user: string) =>
    `**${user}** discovers an infinite snack glitch! 🌟 *nom nom intensifies*`,
  (user: string) =>
    `**${user}** creates a paradox by nomming their own nom! 🌀`,
  (user: string) =>
    `**${user}** achieves peak nom efficiency by nomming themselves! 🎯`,
  (user: string) => `THE GREAT NOM RECURSION: **${user}** noms infinitely! ♾️`,
  (user: string) =>
    `**${user}** breaks the space-time continuum with a self-nom! 🌌`,
  (user: string) =>
    `ALERT: **${user}** has discovered the forbidden self-nom technique! ⚠️`,
];

// Random food emojis for variety
const foodEmojis = [
  "🍙",
  "🍱",
  "🍣",
  "🍜",
  "🍪",
  "🍰",
  "🍡",
  "🍬",
  "🍫",
  "🍩",
  "🍥",
  "🥮",
  "🧁",
  "🥠",
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nom")
    .setDescription("Share a snack with someone! 🍙")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to nom with")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");
      const randomFoodEmoji =
        foodEmojis[Math.floor(Math.random() * foodEmojis.length)];

      // Special case for self-nom
      if (target?.id === interaction.user.id) {
        const selfMessage = selfNomMessages[
          Math.floor(Math.random() * selfNomMessages.length)
        ](interaction.user.toString());

        const [gifUrl] = await Promise.all([getGif("nom")]);

        const embed = new EmbedBuilder()
          .setColor("#FFD700") // Gold color for special self-nom
          .setTitle(
            `${randomFoodEmoji} INFINITE NOM DETECTED ${randomFoodEmoji}`,
          )
          .setDescription(selfMessage)
          .setImage(gifUrl)
          .setFooter({
            text: "Warning: Self-noms may cause dimensional instability",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // Regular nom with someone else
      const [gifUrl, message] = await Promise.all([
        getGif("nom"),
        Promise.resolve(
          getRandomMessage(
            nomMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      // Generate some extra food emojis for decoration
      const decorativeEmojis = Array(3)
        .fill(0)
        .map(() => foodEmojis[Math.floor(Math.random() * foodEmojis.length)])
        .join(" ");

      const embed = new EmbedBuilder()
        .setColor("#FFC0CB") // Pink for cute nom
        .setTitle(`${decorativeEmojis} Snack Time! ${decorativeEmojis}`)
        .setDescription(message)
        .setImage(gifUrl)
        .setFooter({
          text: `Tip: Try /nom @${interaction.user.username} for a special nom!`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Nom command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ The snack disappeared into another dimension! Try again! 🌀",
            ),
        ],
      });
    }
  },
};
