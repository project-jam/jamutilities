import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../../types/Command";
import { getAverageColor } from "fast-average-color-node";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("emoji")
    .setDescription("Generate a mix of two emojis in an embed")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("mix")
        .setDescription("Mix two emojis into an emoji image")
        .addStringOption((option) =>
          option
            .setName("emoji1")
            .setDescription("The first emoji to mix")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji2")
            .setDescription("The second emoji to mix")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      // Get the two emojis provided by the user
      const emoji1 = interaction.options.getString("emoji1", true);
      const emoji2 = interaction.options.getString("emoji2", true);

      // Check if the inputs are emojis
      if (
        !emoji1.match(
          /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}]/u
        ) ||
        !emoji2.match(
          /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B50}]/u
        )
      ) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription("❌ Please provide valid emojis!"),
          ],
        });
        return;
      }

      // Encode the emojis and create the URL for mixing
      const encodedEmoji1 = encodeURIComponent(emoji1);
      const encodedEmoji2 = encodeURIComponent(emoji2);
      const url = `https://emojik.vercel.app/s/${encodedEmoji1}_${encodedEmoji2}?size=1024`;

      // Get the dominant color from the mixed emoji image
      const color = await getAverageColor(url);

      // Create the embed with the URL of the mixed emoji and the dominant color
      const embed = new EmbedBuilder()
        .setTitle(`${emoji1} + ${emoji2}`)
        .setImage(url)
        .setColor(color.hex) // Use the dominant color as the embed color
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error("Error mixing emojis:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Something went wrong while mixing the emojis. Please try again."
            ),
        ],
      });
    }
  },
};

