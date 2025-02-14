import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getGif, getRandomMessage } from "../../utils/otakuGifs";

const blushMessages = [
  (user: string) => `**${user}** blushes heavily >///<`,
  (user: string) => `**${user}**'s face turns bright red`,
  (user: string) => `**${user}** gets all flustered`,
  (user: string) => `aww, **${user}** is blushing!`,
  (user: string) => `**${user}** turns red from embarrassment`,
  (user: string) => `**${user}** feels shy suddenly`,
  (user: string) => `**${user}**'s cheeks turn pink`,
  (user: string) => `a wild blush appears on **${user}**'s face`,
  (user: string) => `**${user}** tries to hide their blushing face`,
  (user: string) => `**${user}** gets all embarrassed`,
];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("blush")
    .setDMPermission(true)
    .setDescription("Show your embarrassed side! 😊"),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const [gifUrl, message] = await Promise.all([
        getGif("blush"),
        Promise.resolve(
          getRandomMessage(blushMessages, interaction.user.toString(), ""),
        ),
      ]);

      const embed = new EmbedBuilder()
        .setColor("#FFB6C1") // Pink for blushing!
        .setDescription(message)
        .setImage(gifUrl)
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      Logger.error("Blush command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Couldn't show that emotion... How embarrassing!",
            ),
        ],
      });
    }
  },
};
