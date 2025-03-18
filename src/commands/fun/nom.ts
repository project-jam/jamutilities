import {
  ChatInputCommandInteraction,
  Message,
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

  prefix: {
    aliases: ["nom", "feed", "nibble"],
    usage: "<@user>", // Example: jam!nom @user
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
                .setDescription("❌ Please mention someone to nom with!")
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!nom @user`")
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

      const randomFoodEmoji =
        foodEmojis[Math.floor(Math.random() * foodEmojis.length)];

      // Special case for self-nom
      if (target.id === user.id) {
        const selfMessage = selfNomMessages[
          Math.floor(Math.random() * selfNomMessages.length)
        ](user.toString());

        const gifUrl = await getGif("nom");

        const embed = new EmbedBuilder()
          .setColor("#FFD700")
          .setTitle(
            `${randomFoodEmoji} INFINITE NOM DETECTED ${randomFoodEmoji}`,
          )
          .setDescription(selfMessage)
          .setImage(gifUrl)
          .setFooter({
            text: "Warning: Self-noms may cause dimensional instability",
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

      // Regular nom with someone else
      const gifUrl = await getGif("nom");
      const message = getRandomMessage(
        nomMessages,
        user.toString(),
        target.toString(),
      );

      // Generate decorative emojis
      const decorativeEmojis = Array(3)
        .fill(0)
        .map(() => foodEmojis[Math.floor(Math.random() * foodEmojis.length)])
        .join(" ");

      const embed = new EmbedBuilder()
        .setColor("#FFC0CB")
        .setTitle(`${decorativeEmojis} Snack Time! ${decorativeEmojis}`)
        .setDescription(message)
        .setImage(gifUrl)
        .setFooter({
          text: `Tip: Try ${isPrefix ? "jam!" : "/"}nom ${isPrefix ? "@" : ""}${user.username} for a special nom!`,
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
      Logger.error("Nom command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ The snack disappeared into another dimension! Try again! 🌀",
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
