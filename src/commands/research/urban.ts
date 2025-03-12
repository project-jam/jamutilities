import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface UrbanDictionaryResponse {
  list: {
    definition: string;
    permalink: string;
    thumbs_up: number;
    thumbs_down: number;
    author: string;
    word: string;
    defid: number;
    current_vote: string;
    written_on: string;
    example: string;
  }[];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("urban")
    .setDescription("Look up a term in the Urban Dictionary")
    .setDMPermission(true)
    .addStringOption((option) =>
      option
        .setName("term")
        .setDescription("The term to look up")
        .setRequired(true),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const term = interaction.options.getString("term", true);
      const encodedTerm = encodeURIComponent(term);

      const response = await fetch(
        `https://api.urbandictionary.com/v0/define?term=${encodedTerm}`,
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: UrbanDictionaryResponse = await response.json();

      if (!data.list || data.list.length === 0) {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ff3838")
              .setDescription(`❌ No definitions found for "${term}".`),
          ],
        });
        return;
      }

      let currentPage = 0;
      const definitions = data.list;

      // Function to clean up the text and format it properly
      const cleanText = (text: string): string => {
        return text
          .replace(/\[|\]/g, "") // Remove square brackets
          .replace(/\r\n/g, "\n") // Normalize line breaks
          .substring(0, 1024); // Limit to 1024 characters for embeds
      };

      // Function to create an embed for the current definition
      const createDefinitionEmbed = (index: number) => {
        const definition = definitions[index];
        const formattedDate = new Date(
          definition.written_on,
        ).toLocaleDateString();

        return new EmbedBuilder()
          .setColor("#1E2124")
          .setTitle(`Urban Dictionary: ${definition.word}`)
          .setURL(definition.permalink)
          .setDescription(
            `**Definition ${index + 1} of ${definitions.length}**`,
          )
          .addFields(
            {
              name: "📝 Definition",
              value:
                cleanText(definition.definition) || "No definition provided",
            },
            {
              name: "📚 Example",
              value: cleanText(definition.example) || "No example provided",
            },
            {
              name: "👍 Upvotes",
              value: definition.thumbs_up.toString(),
              inline: true,
            },
            {
              name: "👎 Downvotes",
              value: definition.thumbs_down.toString(),
              inline: true,
            },
            {
              name: "✍️ Author",
              value: definition.author,
              inline: true,
            },
          )
          .setFooter({
            text: `Submitted on ${formattedDate}`,
          })
          .setTimestamp();
      };

      // Create pagination buttons
      const createButtons = (index: number) => {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId("first")
            .setEmoji("⏮️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId("prev")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === 0),
          new ButtonBuilder()
            .setCustomId("next")
            .setEmoji("▶️")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(index === definitions.length - 1),
          new ButtonBuilder()
            .setCustomId("last")
            .setEmoji("⏭️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(index === definitions.length - 1),
        );
      };

      // Send the initial message with the first definition
      const message = await interaction.editReply({
        embeds: [createDefinitionEmbed(currentPage)],
        components: definitions.length > 1 ? [createButtons(currentPage)] : [],
      });

      // If there's only one definition, no need for a collector
      if (definitions.length <= 1) return;

      // Create button collector
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
      });

      collector.on("collect", async (i) => {
        // Ensure the interaction is from the command initiator
        if (i.user.id !== interaction.user.id) {
          await i.reply({
            content: "❌ This interaction isn't for you!",
            ephemeral: true,
          });
          return;
        }

        // Update the current page based on the button clicked
        switch (i.customId) {
          case "first":
            currentPage = 0;
            break;
          case "prev":
            currentPage = Math.max(0, currentPage - 1);
            break;
          case "next":
            currentPage = Math.min(definitions.length - 1, currentPage + 1);
            break;
          case "last":
            currentPage = definitions.length - 1;
            break;
        }

        // Update the message with the new definition
        await i.update({
          embeds: [createDefinitionEmbed(currentPage)],
          components: [createButtons(currentPage)],
        });
      });

      collector.on("end", async () => {
        // Remove buttons when the collector expires
        try {
          await message.edit({
            components: [],
          });
        } catch (error) {
          // Ignore errors if the message was deleted
        }
      });
    } catch (error) {
      Logger.error("Urban command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to retrieve the definition. Please try again later.",
            ),
        ],
      });
    }
  },
};
