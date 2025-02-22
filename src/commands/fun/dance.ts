import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Messages for when someone tries to cuddle others (becomes self-comfort)
const soloMessages = [
  (user: string) =>
    `**${user}** wraps themselves in a cozy blanket instead! 🌸`,
  (user: string) => `**${user}** discovers the art of self-comfort! ✨`,
  (user: string) =>
    `Plot twist! **${user}** builds a pillow fort and snuggles in! 🏰`,
  (user: string) =>
    `**${user}** doesn't need cuddles when they have plushies! 🧸`,
  (user: string) => `Watch as **${user}** creates the coziest comfort zone! 💫`,
  (user: string) => `**${user}** turns into a human burrito of coziness! 🌯`,
  (user: string) => `SURPRISE! **${user}** becomes one with the fluff! ☁️`,
  (user: string) =>
    `**${user}** said "cuddles are nice but have you tried MAXIMUM COZY?" 🌟`,
];

// Messages for cuddling with yourself (becomes transcendent)
const selfCuddleMessages = [
  (user: string) => `**${user}** achieves cuddle enlightenment! ✨`,
  (user: string) =>
    `**${user}** discovers they were the ultimate cuddle buddy all along! 💫`,
  (user: string) => `Plot twist! **${user}** creates a cuddle paradox! 🌌`,
  (user: string) => `**${user}** transcends the boundaries of cuddling! 🎭`,
  (user: string) =>
    `**${user}** unlocks the secret technique: INFINITE SELF-CUDDLE! 💫`,
  (user: string) =>
    `The legends were true! **${user}** becomes the Cuddle Master! 👑`,
  (user: string) =>
    `**${user}** demonstrates the forbidden art of quantum cuddling! 🌟`,
  (user: string) =>
    `Reality bends as **${user}** creates a cuddle singularity! 🌀`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("cuddle")
    .setDescription("Start a cozy cuddle adventure! 🤗✨")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to cuddle (or try to... results may vary!)")
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");
      const [gifUrl] = await Promise.all([getGif("cuddle")]);

      // If they target someone else (including no target), they get self-comfort!
      if (!target || target.id !== interaction.user.id) {
        const soloMessage = soloMessages[
          Math.floor(Math.random() * soloMessages.length)
        ](interaction.user.toString());

        const embed = new EmbedBuilder()
          .setColor("#9400D3") // Deep Purple for cozy solo time
          .setTitle("✨ Cozy Time Activated! ✨")
          .setDescription(soloMessage)
          .setImage(gifUrl)
          .setFooter({
            text: "Protip: Try /cuddle @yourself to unlock ultimate coziness! 👀",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // If they target themselves, they achieve cuddle transcendence!
      const selfCuddleMessage = selfCuddleMessages[
        Math.floor(Math.random() * selfCuddleMessages.length)
      ](interaction.user.toString());

      const embed = new EmbedBuilder()
        .setColor("#FF69B4") // Hot Pink for transcendent self-cuddles
        .setTitle("🌟 ULTIMATE CUDDLE ACHIEVED! 🌟")
        .setDescription(selfCuddleMessage)
        .setImage(gifUrl)
        .setFooter({
          text: "You have unlocked the secrets of cosmic cuddling! ✨",
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
              "❌ The cuddle dimension collapsed from too much coziness! Try again! 🌌✨",
            ),
        ],
      });
    }
  },
};
