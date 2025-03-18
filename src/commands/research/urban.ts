import {
  ChatInputCommandInteraction,
  Message,
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

  prefix: {
    aliases: ["urban", "ud", "urbandict"],
    usage: "<term>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let searchTerm: string;

      if (isPrefix) {
        const message = interaction as Message;
        const args = message.content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/);

        args.shift(); // Remove command name

        if (args.length < 1) {
          await message.reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription("❌ Please provide a term to look up!")
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}urban <term>`,
                    `${process.env.PREFIX || "jam!"}ud <term>`,
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}urban yeet`,
                    `${process.env.PREFIX || "jam!"}ud poggers`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        searchTerm = args.join(" ");
        await message.channel.sendTyping();
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        searchTerm = (
          interaction as ChatInputCommandInteraction
        ).options.getString("term", true);
      }

      const response = await fetch(
        `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(
          searchTerm,
        )}`,
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data: UrbanDictionaryResponse = await response.json();

      if (!data.list || data.list.length === 0) {
        const notFoundEmbed = new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(`❌ No definitions found for "${searchTerm}".`);

        if (isPrefix) {
          await (interaction as Message).reply({ embeds: [notFoundEmbed] });
        } else {
          await (interaction as ChatInputCommandInteraction).editReply({
            embeds: [notFoundEmbed],
          });
        }
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

      // Send initial message
      const message = await (isPrefix
        ? (interaction as Message).reply({
            embeds: [createDefinitionEmbed(currentPage)],
            components:
              definitions.length > 1 ? [createButtons(currentPage)] : [],
            fetchReply: true,
          })
        : (interaction as ChatInputCommandInteraction).editReply({
            embeds: [createDefinitionEmbed(currentPage)],
            components:
              definitions.length > 1 ? [createButtons(currentPage)] : [],
          }));

      // If there's only one definition, no need for a collector
      if (definitions.length <= 1) return;

      // Create button collector
      const collector = (message as Message).createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 300000, // 5 minutes
      });

      collector.on("collect", async (i) => {
        // Ensure the interaction is from the command initiator
        if (
          i.user.id !==
          (isPrefix
            ? (interaction as Message).author.id
            : (interaction as ChatInputCommandInteraction).user.id)
        ) {
          await i.reply({
            content: "❌ These buttons aren't for you!",
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

      collector.on("end", () => {
        // Remove buttons when the collector expires
        if (isPrefix) {
          (message as Message).edit({ components: [] }).catch(() => {});
        } else {
          (interaction as ChatInputCommandInteraction)
            .editReply({ components: [] })
            .catch(() => {});
        }
      });
    } catch (error) {
      Logger.error("Urban dictionary command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ Failed to fetch definition. Please try again later.",
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
