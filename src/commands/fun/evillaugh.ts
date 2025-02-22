import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Evil decorative elements
const evilDecorations = [
  "😈",
  "👿",
  "🦹",
  "💀",
  "⚡",
  "🔥",
  "🌑",
  "🗡️",
  "⛧",
  "☠️",
  "🦇",
  "🕸️",
  "🐍",
  "🌚",
  "🎭",
  "⚔️",
  "🏴‍☠️",
  "🫦",
  "💢",
  "🌀",
];

// Enhanced evil messages with more dramatic flair
const evilMessages = [
  (user: string, target: string) =>
    `MUAHAHAHA! **${user}** unleashes ultimate darkness upon **${target}**!`,
  (user: string, target: string) =>
    `**${user}** summons their most diabolical laugh towards **${target}**!`,
  (user: string, target: string) =>
    `**${user}** reveals their true villainous nature to **${target}**!`,
  (user: string, target: string) =>
    `BEWARE **${target}**! **${user}** has awakened their inner demon!`,
  (user: string, target: string) =>
    `**${user}** channels pure malevolence towards **${target}**!`,
  (user: string, target: string) =>
    `**${target}** trembles before **${user}**'s sinister cackling!`,
  (user: string, target: string) =>
    `**${user}** bathes in darkness as they laugh at **${target}**!`,
  (user: string, target: string) =>
    `A maniacal laugh pierces the void as **${user}** targets **${target}**!`,
  (user: string, target: string) =>
    `**${user}** weaves shadows of doom around **${target}**!`,
  (user: string, target: string) =>
    `The very air grows cold as **${user}** laughs at **${target}**!`,
];

// Helper function for random decorations
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => evilDecorations[Math.floor(Math.random() * evilDecorations.length)],
    )
    .join(" ");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("evil")
    .setDescription("Unleash your darkest laugh! 😈")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("laugh")
        .setDescription("Evil laugh at your unfortunate victim! 😈")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("Your target for villainous mockery")
            .setRequired(true),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Prevent laughing at yourself - villains don't mock themselves!
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(
                "❌ A true villain laughs at others, not themselves! Choose a worthy victim! 😈",
              )
              .setFooter({
                text: "Evil 101: Always target someone else!",
              }),
          ],
        });
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("evillaugh"),
        Promise.resolve(
          getRandomMessage(
            evilMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      // Create evil decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#800080") // Purple for evil vibes
        .setTitle(`${topDecorations} EVIL LAUGHTER UNLEASHED ${topDecorations}`)
        .setDescription(`${message}\n\n${bottomDecorations}`)
        .setImage(gifUrl)
        .setFooter({
          text: `"All villains have an evil laugh!" ${getRandomDecorations(1)}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Evil laugh command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Your evil laugh turned into a squeak... How UN-villainous! 😱",
            ),
        ],
      });
    }
  },
};
