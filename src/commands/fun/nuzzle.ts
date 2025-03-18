import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Cute animal emoticons for variety
const cuteEmotes = [
  "(◕ᴥ◕)",
  "(｡♥‿♥｡)",
  "ʕ•ᴥ•ʔ",
  "(≧◡≦)",
  "(◕‿◕✿)",
  "♪(๑ᴖ◡ᴖ๑)♪",
  "(｡◕‿◕｡)",
  "◕‿◕",
  "₍ᐢ•ﻌ•ᐢ₎",
  "( ◜‿◝ )♡",
];

// Regular nuzzle messages
const nuzzleMessages = [
  (user: string, target: string) =>
    `**${user}** nuzzles **${target}** affectionately ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** snuggles close and gives **${target}** a gentle nuzzle ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${target}** receives the softest nuzzles from **${user}** ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** can't resist giving **${target}** adorable nuzzles ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** showes their affection by nuzzling **${target}** ${getRandomEmote()}`,
  (user: string, target: string) =>
    `awww! **${user}** nuzzles **${target}** so sweetly ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${user}** gives **${target}** the most precious nuzzles ${getRandomEmote()}`,
  (user: string, target: string) =>
    `**${target}** gets surprised by **${user}**'s sudden nuzzle attack ${getRandomEmote()}`,
];

// Chaotic self-nuzzle messages
const selfNuzzleMessages = [
  (user: string) =>
    `**${user}** discovers they're actually a cat and starts self-nuzzling! 🐱`,
  (user: string) =>
    `**${user}** achieves peak floof by becoming their own nuzzle buddy! ✨`,
  (user: string) =>
    `BREAKING NEWS: **${user}** invents revolutionary self-nuzzle technique! 📰`,
  (user: string) =>
    `**${user}** turns into a ball of pure nuzzles! Science is baffled! 🔬`,
  (user: string) =>
    `**${user}** creates a nuzzle feedback loop - CUTENESS OVERLOAD! 💫`,
  (user: string) =>
    `Alert! **${user}**'s self-nuzzle levels are off the charts! 📊`,
  (user: string) =>
    `**${user}** transcends reality through the power of self-nuzzles! 🌌`,
  (user: string) => `**${user}** becomes ONE WITH THE NUZZLE! ∞`,
];

// Helper function to get random emoticon
function getRandomEmote(): string {
  return cuteEmotes[Math.floor(Math.random() * cuteEmotes.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("nuzzle")
    .setDescription("Give someone adorable nuzzles! (◕ᴥ◕)")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to nuzzle")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["nuzzle", "snuggle", "nuzz"],
    usage: "<@user>", // Example: jam!nuzzle @user
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let target;
      const user = isPrefix
        ? (interaction as Message).author
        : (interaction as ChatInputCommandInteraction).user;

      if (isPrefix) {
        const message = interaction as Message;
        await message.channel.sendTyping();
        target = message.mentions.users.first();

        if (!target) {
          const prefix = process.env.PREFIX || "jam!";
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  `❌ Please mention someone to nuzzle! ${getRandomEmote()}`,
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!nuzzle @user`")
                    .join("\n"),
                }),
            ],
          });
          return;
        }
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        target = (interaction as ChatInputCommandInteraction).options.getUser(
          "user",
        );
      }

      // Self-nuzzle case
      if (target.id === user.id) {
        const selfMessage = selfNuzzleMessages[
          Math.floor(Math.random() * selfNuzzleMessages.length)
        ](user.toString());

        const gifUrl = await getGif("nuzzle");

        // Create sparkle border effect with emoticons
        const borderTop = Array(3)
          .fill("")
          .map(() => getRandomEmote())
          .join(" ");
        const borderBottom = Array(3)
          .fill("")
          .map(() => getRandomEmote())
          .join(" ");

        const embed = new EmbedBuilder()
          .setColor("#FFB6C1")
          .setTitle(`${borderTop} ULTIMATE NUZZLE ${borderTop}`)
          .setDescription(`${selfMessage}\n\n${borderBottom} ∞ ${borderBottom}`)
          .setImage(gifUrl)
          .setFooter({
            text: "Warning: Excessive self-nuzzling may cause spontaneous transformation into a fluffy creature",
            iconURL: user.displayAvatarURL(),
          })
          .setTimestamp();

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [embed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [embed],
          });
        }
        return;
      }

      // Regular nuzzle case
      const gifUrl = await getGif("nuzzle");
      const message = getRandomMessage(
        nuzzleMessages,
        user.toString(),
        target.toString(),
      );

      const embed = new EmbedBuilder()
        .setColor("#FFC0CB")
        .setTitle(`${getRandomEmote()} Nuzzle Time! ${getRandomEmote()}`)
        .setDescription(message)
        .setImage(gifUrl)
        .setFooter({
          text: `Tip: Try ${isPrefix ? "jam!" : "/"}nuzzle ${isPrefix ? "@" : ""}${user.username} to discover your inner floof!`,
          iconURL: user.displayAvatarURL(),
        })
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [embed],
        });
      }
    } catch (error) {
      Logger.error("Nuzzle command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The nuzzles were too powerful! ${getRandomEmote()} Try again!`,
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
