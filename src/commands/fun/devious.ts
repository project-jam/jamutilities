import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

// Messages for when someone tries to be devious towards others (becomes self-devious)
const soloMessages = [
  (user: string) =>
    `**${user}** tried to scheme but became their own arch-nemesis! 😈`,
  (user: string) =>
    `**${user}** discovers the art of self-villainy! MUAHAHAHA! 🦹‍♂️`,
  (user: string) =>
    `Plot twist! **${user}** becomes the mastermind of their own chaos! ✨`,
  (user: string) =>
    `**${user}** doesn't need victims when they have EVIL GENIUS! 🧠`,
  (user: string) =>
    `Watch as **${user}** practices their evil laugh in the mirror! 🪞`,
  (user: string) => `**${user}** realizes being devious alone is MORE EVIL! 💫`,
  (user: string) =>
    `SURPRISE! **${user}** starts their own villain origin story! 📖`,
  (user: string) =>
    `**${user}** said "forget targeting others" and chose PURE CHAOS! 🌀`,
];

// Messages for being devious with yourself (becomes ultimate evil)
const selfDeviousMessages = [
  (user: string) =>
    `**${user}** achieves PEAK EVIL by plotting against themselves! 🦹`,
  (user: string) =>
    `**${user}** discovers they were the final boss all along! 👑`,
  (user: string) =>
    `Plot twist! **${user}** creates an infinite loop of villainy! ♾️`,
  (user: string) =>
    `**${user}** transcends normal evil and becomes CHAOS INCARNATE! 💥`,
  (user: string) => `**${user}** masters the forbidden art: SELF-SCHEMING! 📜`,
  (user: string) =>
    `The prophecy was true! **${user}** becomes the ULTIMATE VILLAIN! 😈`,
  (user: string) =>
    `**${user}** demonstrates advanced evil techniques: PARADOX PLOTTING! 🌀`,
  (user: string) =>
    `Reality shatters as **${user}** creates a devious singularity! 🌌`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("devious")
    .setDescription("Unleash your inner villain! 😈✨")
    .setDMPermission(true)
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription(
          "The target of your schemes (or not... evil works in mysterious ways!)",
        )
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");
      const [gifUrl] = await Promise.all([getGif("evillaugh")]);

      // If they target someone else (including no target), they become self-devious!
      if (!target || target.id !== interaction.user.id) {
        const soloMessage = soloMessages[
          Math.floor(Math.random() * soloMessages.length)
        ](interaction.user.toString());

        const embed = new EmbedBuilder()
          .setColor("#800080") // Deep Purple for solo evil
          .setTitle("😈 EVIL PROTOCOL ACTIVATED! 😈")
          .setDescription(soloMessage)
          .setImage(gifUrl)
          .setFooter({
            text: "Protip: Try /devious @yourself to unlock ULTIMATE EVIL! 👀",
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      // If they target themselves, they achieve PEAK VILLAINY!
      const selfDeviousMessage = selfDeviousMessages[
        Math.floor(Math.random() * selfDeviousMessages.length)
      ](interaction.user.toString());

      const embed = new EmbedBuilder()
        .setColor("#4B0082") // Indigo for transcendent evil
        .setTitle("🌌 ULTIMATE EVIL ACHIEVED! 🌌")
        .setDescription(selfDeviousMessage)
        .setImage(gifUrl)
        .setFooter({
          text: "You have mastered the art of SUPREME VILLAINY! 😈",
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Devious command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Your evil plans were TOO evil and imploded! Try again! 💥",
            ),
        ],
      });
    }
  },
};
