import {
  ChatInputCommandInteraction,
  Message,
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

  prefix: {
    aliases: ["hug", "hugs", "embrace"],
    usage: "<@user>", // Example: jam!hug @user
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let target;

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
                  `❌ Please mention someone to hug! ${getRandomKaomoji()}`,
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!hug @user`")
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
          true,
        );
      }

      // Don't allow hugging yourself
      const userId = isPrefix
        ? (interaction as Message).author.id
        : (interaction as ChatInputCommandInteraction).user.id;

      if (target.id === userId) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ Aww, need a hug? Share your warmth with others instead! ${getRandomKaomoji()}`,
          )
          .setFooter({
            text: "Hugs are meant to be shared with friends! 💝",
          });

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [errorEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [errorEmbed],
          });
        }
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("hug"),
        Promise.resolve(
          getRandomMessage(
            hugMessages,
            isPrefix
              ? (interaction as Message).author.toString()
              : (interaction as ChatInputCommandInteraction).user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#ffd1dc")
        .setTitle(`${topDecorations} Warm Hugs Time! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Spreading warmth and happiness! ${getRandomKaomoji()}`,
          iconURL: isPrefix
            ? (interaction as Message).author.displayAvatarURL()
            : (
                interaction as ChatInputCommandInteraction
              ).user.displayAvatarURL(),
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
      Logger.error("Hug command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ The hug got lost in a cloud of sparkles... Try again! ${getRandomKaomoji()}`,
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
