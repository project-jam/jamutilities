import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

const pokeMessages = [
  (user: string, target: string) => `**${user}** pokes **${target}** playfully`,
  (user: string, target: string) => `**${user}** keeps poking **${target}**`,
  (user: string, target: string) =>
    `hey **${target}**! **${user}** is poking you!`,
  (user: string, target: string) =>
    `**${user}** can't stop poking **${target}**`,
  (user: string, target: string) =>
    `poke poke! **${user}** bothers **${target}**`,
  (user: string, target: string) => `**${target}** gets poked by **${user}**`,
  (user: string, target: string) => `**${user}** sneakily pokes **${target}**`,
  (user: string, target: string) =>
    `**${target}** feels a poke from **${user}**`,
  (user: string, target: string) => `*poke poke* **${user}** → **${target}**`,
  (user: string, target: string) =>
    `**${user}** demands **${target}**'s attention with a poke`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("poke")
    .setDescription("Poke someone! 👉")
    .addUserOption((option) =>
      option
        .setName("user")
        .setDescription("The user to poke")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const target = interaction.options.getUser("user");

      // Don't allow poking yourself
      if (target?.id === interaction.user.id) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Poking yourself? That's just weird!"),
          ],
        });
        return;
      }

      const [gifUrl, message] = await Promise.all([
        getGif("poke"),
        Promise.resolve(
          getRandomMessage(
            pokeMessages,
            interaction.user.toString(),
            target.toString(),
          ),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#87CEEB") // Sky blue for playful pokes!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Poke command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Your poke missed! Try again!"),
        ],
      });
    }
  },
};
