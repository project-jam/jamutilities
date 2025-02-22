import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Cute kaomoji for variety
const blushKaomoji = [
  "(〃ω〃)",
  "(´,,•ω•,,)",
  "(⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)",
  "(*≧∀≦*)",
  "(⁄ ⁄•⁄ω⁄•⁄ ⁄)",
  "(〃▽〃)",
  "(/ω＼)",
  "(⸝⸝⸝›௰‹⸝⸝⸝)",
  "(⸝⸝⸝• ⴗ •⸝⸝⸝)",
  "(≧◡≦)",
  "(⁄⁄⁄ᵒ̴̶̷᷄ᐞᵒ̴̶̷᷅⁄⁄⁄)",
];

// Decorative sparkles and hearts
const decorations = ["✿", "❀", "💮", "🌸", "✨", "💫", "⭐", "💝", "💗", "💓"];

// Enhanced blush messages with kaomoji
const blushMessages = [
  (user: string) => `**${user}** blushes heavily ${getRandomKaomoji()}`,
  (user: string) => `**${user}**'s face turns bright red ${getRandomKaomoji()}`,
  (user: string) => `**${user}** gets all flustered ${getRandomKaomoji()}`,
  (user: string) => `aww, **${user}** is blushing! ${getRandomKaomoji()}`,
  (user: string) =>
    `**${user}** turns red from embarrassment ${getRandomKaomoji()}`,
  (user: string) => `**${user}** feels shy suddenly ${getRandomKaomoji()}`,
  (user: string) => `**${user}**'s cheeks turn pink ${getRandomKaomoji()}`,
  (user: string) =>
    `a wild blush appears on **${user}**'s face ${getRandomKaomoji()}`,
  (user: string) =>
    `**${user}** tries to hide their blushing face ${getRandomKaomoji()}`,
  (user: string) => `**${user}** gets all embarrassed ${getRandomKaomoji()}`,
  (user: string) =>
    `**${user}** radiates adorable bashfulness ${getRandomKaomoji()}`,
  (user: string) =>
    `**${user}**'s face glows with a rosy tint ${getRandomKaomoji()}`,
];

// Helper functions for random elements
function getRandomKaomoji(): string {
  return blushKaomoji[Math.floor(Math.random() * blushKaomoji.length)];
}

function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(() => decorations[Math.floor(Math.random() * decorations.length)])
    .join(" ");
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("blush")
    .setDMPermission(true)
    .setDescription("Show your adorably embarrassed side! (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const [gifUrl, message] = await Promise.all([
        getGif("blush"),
        Promise.resolve(
          getRandomMessage(blushMessages, interaction.user.toString(), ""),
        ),
      ]);

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1") // Pink for blushing!
        .setTitle(`${topDecorations} Blushing Time! ${topDecorations}`)
        .setDescription(`${message}\n\n${bottomDecorations}`)
        .setImage(gifUrl)
        .setFooter({
          text: `So kawaii! ${getRandomKaomoji()}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Blush command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              `❌ Couldn't show that emotion... How embarrassing! ${getRandomKaomoji()}`,
            ),
        ],
      });
    }
  },
};
