import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  ApplicationCommandOptionType,
} from "discord.js";
import type { Command } from "../../types/Command";
import axios from "axios";

interface SameEnergyImage {
  id: string;
  url: string;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("sameimage")
    .setDescription("Search for images using Same Energy")
    .addStringOption((option) =>
      option
        .setName("query")
        .setDescription("What kind of image are you looking for?")
        .setRequired(true)
    ),

  prefix: {
    aliases: ["same", "si", "simg"],
    usage: "<search query>",
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false
  ) {
    let searchQuery: string;

    if (isPrefix) {
      const args = (interaction as Message).content.split(" ").slice(1);
      if (!args.length) {
        return await (interaction as Message).reply("Please provide a search term!");
      }
      searchQuery = args.join(" ");
    } else {
      searchQuery = interaction.options.getString("query", true);
    }

    try {
      const response = await axios.get(`https://imageapi.same.energy/search`, {
        params: {
          text: searchQuery,
          n: 20
        }
      });

      const images: SameEnergyImage[] = response.data.results || [];

      if (images.length === 0) {
        const noResultsEmbed = new EmbedBuilder()
          .setTitle("No Results")
          .setDescription(`No images found for "${searchQuery}"`)
          .setColor("#ff0000");

        return isPrefix
          ? await (interaction as Message).reply({ embeds: [noResultsEmbed] })
          : await (interaction as ChatInputCommandInteraction).reply({ embeds: [noResultsEmbed] });
      }

      const randomImage = images[Math.floor(Math.random() * images.length)];

      const embed = new EmbedBuilder()
        .setTitle(`Same Energy: ${searchQuery}`)
        .setImage(randomImage.url)
        .setColor("#00ff00")
        .setFooter({ text: "Powered by Same Energy" })
        .setTimestamp();

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [embed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({ embeds: [embed] });
      }

    } catch (error) {
      const errorEmbed = new EmbedBuilder()
        .setTitle("Error")
        .setDescription("Failed to fetch images. Please try again later.")
        .setColor("#ff0000");

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [errorEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).reply({ embeds: [errorEmbed] });
      }
    }
  },
};
