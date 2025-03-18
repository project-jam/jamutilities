import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif } from "../../utils/otakuGifs";

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
  "🎪",
  "🔮",
  "🎎",
  "🪦",
];

// Evil emoticons for variety
const evilEmotes = [
  "( ⚆ _ ⚆ )",
  "(＾▽＾)っ†",
  "( ╹◡╹)つ──☆*:・ﾟ",
  "(･｀ｪ´･)つ",
  "(｀∀´)Ψ",
  "╰( ⁰ ਊ ⁰ )━☆ﾟ.*･｡ﾟ",
  "(≖ᴗ≖✿)",
  "(｀㊥益㊥)Ψ",
  "( ･᷄ὢ･᷅ )",
  "(｀∀´))",
  "(⊙‿⊙✿)",
  "( ͡° ͜ʖ ͡°)",
];

// Messages for solo devious plotting
const soloDeviousMessages = [
  (user: string) =>
    `**${user}** unleashes their ultimate evil scheme! ${getRandomEmote()}`,
  (user: string) =>
    `MWAHAHA! **${user}** becomes the ultimate chaos bringer! ${getRandomEmote()}`,
  (user: string) =>
    `**${user}** unlocks forbidden evil powers! The world trembles! ${getRandomEmote()}`,
  (user: string) =>
    `Watch out! **${user}** has achieved MAXIMUM EVIL! ${getRandomEmote()}`,
  (user: string) =>
    `**${user}** practices their evil laugh in the mirror! Perfect form! ${getRandomEmote()}`,
  (user: string) =>
    `The prophecy is fulfilled! **${user}** embraces pure chaos! ${getRandomEmote()}`,
];

// Messages for targeting others with devious plans
const targetDeviousMessages = [
  (user: string, target: string) =>
    `**${user}** plots an evil scheme against **${target}**! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `MWAHAHA! **${user}** targets **${target}** with pure mischief! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** summons chaotic energy towards **${target}**! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${target}** better watch out! **${user}** has EVIL PLANS! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** initiates villainous protocols against **${target}**! ${getRandomEmote()}`,
  (user: string, target: string) =>
    `The dark prophecy begins as **${user}** targets **${target}**! ${getRandomEmote()}`,
];

// Helper functions for random elements
function getRandomEmote(): string {
  return evilEmotes[Math.floor(Math.random() * evilEmotes.length)];
}

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
    .setName("devious")
    .setDescription("Unleash your inner villain! 😈")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Your unfortunate target (optional)")
        .setRequired(false),
    ),

  prefix: {
    aliases: ["devious", "evil", "villain"],
    usage: "@user",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      if (isPrefix) {
        // Handle prefix command
        const message = interaction as Message;
        const target = message.mentions.users.first();
        const user = message.author;

        const [gifUrl] = await Promise.all([getGif("evillaugh")]);
        const topDecorations = getRandomDecorations(3);
        const bottomDecorations = getRandomDecorations(3);

        const embed = new EmbedBuilder()
          .setColor("#800080")
          .setTitle(
            `${topDecorations} EVIL SCHEME ACTIVATED! ${topDecorations}`,
          );

        if (!target || target.id === user.id) {
          // Solo evil
          const soloMessage = soloDeviousMessages[
            Math.floor(Math.random() * soloDeviousMessages.length)
          ](user.toString());
          embed.setDescription(`${soloMessage}\n\n${bottomDecorations}`);
        } else {
          // Targeted evil
          const deviousMessage = targetDeviousMessages[
            Math.floor(Math.random() * targetDeviousMessages.length)
          ](user.toString(), target.toString());
          embed.setDescription(`${deviousMessage}\n\n${bottomDecorations}`);
        }

        embed
          .setImage(gifUrl)
          .setFooter({
            text: `Embracing the darkness! ${getRandomEmote()}`,
            iconURL: user.displayAvatarURL(),
          })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } else {
        // Handle slash command
        const slashInteraction = interaction as ChatInputCommandInteraction;
        await slashInteraction.deferReply();

        const target = slashInteraction.options.getUser("target");
        const user = slashInteraction.user;

        const [gifUrl] = await Promise.all([getGif("evillaugh")]);
        const topDecorations = getRandomDecorations(3);
        const bottomDecorations = getRandomDecorations(3);

        const embed = new EmbedBuilder()
          .setColor("#800080")
          .setTitle(
            `${topDecorations} EVIL SCHEME ACTIVATED! ${topDecorations}`,
          );

        if (!target || target.id === user.id) {
          // Solo evil
          const soloMessage = soloDeviousMessages[
            Math.floor(Math.random() * soloDeviousMessages.length)
          ](user.toString());
          embed.setDescription(`${soloMessage}\n\n${bottomDecorations}`);
        } else {
          // Targeted evil
          const deviousMessage = targetDeviousMessages[
            Math.floor(Math.random() * targetDeviousMessages.length)
          ](user.toString(), target.toString());
          embed.setDescription(`${deviousMessage}\n\n${bottomDecorations}`);
        }

        embed
          .setImage(gifUrl)
          .setFooter({
            text: `Embracing the darkness! ${getRandomEmote()}`,
            iconURL: user.displayAvatarURL(),
          })
          .setTimestamp();

        await slashInteraction.editReply({ embeds: [embed] });
      }
    } catch (error) {
      Logger.error("Devious command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ Your evil plans were TOO evil and imploded! Try again! ${getRandomEmote()}`,
        );

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [errorEmbed],
        });
      }
    }
  },
};
