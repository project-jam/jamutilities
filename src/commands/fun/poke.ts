import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Playful decorative elements
const pokeDecorations = [
  "👉",
  "👆",
  "✨",
  "💫",
  "⭐",
  "💢",
  "💭",
  "❗",
  "❕",
  "💨",
  "🌟",
  "☆",
  "⚡",
  "💫",
  "✌️",
  "🫵",
  "🎯",
  "🎪",
  "🎭",
  "🎡",
];

// Mischievous kaomoji
const pokeKaomoji = [
  "(･ω<)☆",
  "(｀∀´)Ψ",
  "(づ｡◕‿‿◕｡)づ",
  "(｀∀´)ノ",
  "(´･ω･`)つ",
  "(｀⌒´メ)",
  "(・∀・)ノ",
  "(｀▽´)-σ",
  "(σ･∀･)σ",
  "(っ´ω`)ﾉ",
  "(^・ω・^)",
  "( ´∀｀)ノ",
];

// Enhanced poke messages with more playfulness
const pokeMessages = [
  (user: string, target: string) =>
    `**${user}** pokes **${target}** with mischievous intent!`,
  (user: string, target: string) =>
    `**${user}** just can't stop poking **${target}**! Poke poke!`,
  (user: string, target: string) =>
    `hey **${target}**! **${user}** demands attention with endless pokes!`,
  (user: string, target: string) =>
    `**${user}** unleashes a barrage of pokes on **${target}**!`,
  (user: string, target: string) =>
    `poke poke poke! **${user}** won't leave **${target}** alone!`,
  (user: string, target: string) =>
    `**${target}** becomes **${user}**'s poking target!`,
  (user: string, target: string) =>
    `**${user}** sneakily approaches **${target}** for a surprise poke!`,
  (user: string, target: string) =>
    `a wild poke appears! **${user}** strikes **${target}**!`,
  (user: string, target: string) =>
    `*poke poke poke* **${user}** launches Operation: Annoy **${target}**!`,
  (user: string, target: string) =>
    `**${user}** initiates tactical poking maneuvers on **${target}**!`,
];

// Helper functions for random elements
function getRandomDecorations(count: number): string {
  return Array(count)
    .fill(0)
    .map(
      () => pokeDecorations[Math.floor(Math.random() * pokeDecorations.length)],
    )
    .join(" ");
}

function getRandomKaomoji(): string {
  return pokeKaomoji[Math.floor(Math.random() * pokeKaomoji.length)];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poke")
    .setDescription("Initiate tactical poking! (｀∀´)ノ")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("Your unsuspecting poke target")
        .setRequired(true),
    ),

  prefix: {
    aliases: ["poke", "boop"],
    usage: "<@user>", // Example: jam!poke @user
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
                  `❌ Please mention someone to poke! ${getRandomKaomoji()}`,
                )
                .addFields({
                  name: "Usage",
                  value: command.prefix.aliases
                    .map((alias) => `${prefix}${alias} <@user>`)
                    .concat("Example: `jam!poke @user`")
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

      // Don't allow poking yourself
      if (target.id === user.id) {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(
            `❌ Poking yourself? That's not how this works! ${getRandomKaomoji()}`,
          )
          .setFooter({
            text: "Find someone else to bother! 👉",
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

      const gifUrl = await getGif("poke");
      const message = getRandomMessage(
        pokeMessages,
        user.toString(),
        target.toString(),
      );

      // Create decorative borders
      const topDecorations = getRandomDecorations(3);
      const bottomDecorations = getRandomDecorations(3);

      const embed = new EmbedBuilder()
        .setColor("#87CEEB")
        .setTitle(`${topDecorations} POKE ATTACK! ${topDecorations}`)
        .setDescription(
          `${message} ${getRandomKaomoji()}\n\n${bottomDecorations}`,
        )
        .setImage(gifUrl)
        .setFooter({
          text: `Mission accomplished! Target has been poked! ${getRandomKaomoji()}`,
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
      Logger.error("Poke command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          `❌ Critical miss! Your poke failed to connect! ${getRandomKaomoji()}`,
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
