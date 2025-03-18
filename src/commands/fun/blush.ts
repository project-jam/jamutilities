import {
  ChatInputCommandInteraction,
  Message,
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
const decorations = [
  "✿",
  "❀",
  "💮",
  "🌸",
  "✨",
  "💫",
  "⭐",
  "💝",
  "💗",
  "💓",
  "🎀",
  "🌺",
  "🌼",
  "🌻",
  "☀️",
  "🌈",
  "🦋",
  "💐",
  "🍀",
  "💕",
];

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
    .setDescription("Show your adorably embarrassed side! (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)")
    .setDMPermission(true),

  prefix: {
    aliases: ["blush", "shy", "embarrassed", "KYAA!"], // Include base command and fun alternatives
    usage: "", // No arguments needed
  },

  async execute(
    context: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    if (!isPrefix) {
      await (context as ChatInputCommandInteraction).deferReply();
    }

    try {
      const user = isPrefix
        ? (context as Message).author
        : (context as ChatInputCommandInteraction).user;

      const [gifUrl, message] = await Promise.all([
        getGif("blush"),
        Promise.resolve(getRandomMessage(blushMessages, user.toString(), "")),
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
      Logger.error("Blush command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ Couldn't show that emotion... How embarrassing! ${getRandomKaomoji()}`,
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
