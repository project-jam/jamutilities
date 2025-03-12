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

interface AnimeResponse {
  data: AnimeResult[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
  };
}

interface AnimeResult {
  mal_id: number;
  url: string;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
  };
  trailer: {
    url: string;
    embed_url: string;
  };
  title: string;
  title_english: string;
  title_japanese: string;
  type: string;
  source: string;
  episodes: number;
  status: string;
  airing: boolean;
  aired: {
    from: string;
    to: string;
    string: string;
  };
  duration: string;
  rating: string;
  score: number;
  scored_by: number;
  rank: number;
  popularity: number;
  members: number;
  favorites: number;
  synopsis: string;
  background: string;
  season: string;
  year: number;
  studios: {
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }[];
  genres: {
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }[];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("anime")
    .setDescription("Get information about anime shows")
    .setDMPermission(true)
    .addSubcommand((subcommand) =>
      subcommand
        .setName("search")
        .setDescription("Search for anime by title")
        .addStringOption((option) =>
          option
            .setName("title")
            .setDescription("The title of the anime to search for")
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("random")
        .setDescription("Get a random anime recommendation"),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("top")
        .setDescription("Get the top anime list")
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("Type of anime to show")
            .setRequired(false)
            .addChoices(
              { name: "TV Shows", value: "tv" },
              { name: "Movies", value: "movie" },
              { name: "OVAs", value: "ova" },
              { name: "Specials", value: "special" },
            ),
        ),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case "search":
          const title = interaction.options.getString("title", true);
          await handleAnimeSearch(interaction, title);
          break;
        case "random":
          await handleRandomAnime(interaction);
          break;
        case "top":
          const type = interaction.options.getString("type");
          await handleTopAnime(interaction, type);
          break;
      }
    } catch (error) {
      Logger.error("Anime command failed:", error);
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription(
              "❌ Failed to fetch anime information. Please try again later.",
            ),
        ],
      });
    }
  },
};

async function handleAnimeSearch(
  interaction: ChatInputCommandInteraction,
  title: string,
) {
  // Enforce SFW filter in the API call
  const response = await fetch(
    `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(
      title,
    )}&sfw=true&limit=10`,
  );

  if (!response.ok) {
    throw new Error(`Jikan API returned ${response.status}`);
  }

  const data: AnimeResponse = await response.json();

  if (!data.data || data.data.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription(`❌ No suitable anime found matching "${title}".`),
      ],
    });
    return;
  }

  // Show paginated results if multiple are found
  await showPaginatedResults(interaction, data.data, "search");
}

async function handleRandomAnime(interaction: ChatInputCommandInteraction) {
  // Explicitly request SFW content only
  const response = await fetch(
    "https://api.jikan.moe/v4/random/anime?sfw=true",
  );

  if (!response.ok) {
    throw new Error(`Jikan API returned ${response.status}`);
  }

  const data = await response.json();
  const anime = data.data;

  if (!anime) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Failed to get a random anime. Please try again."),
      ],
    });
    return;
  }

  // Check if the result is safe (double check despite API filter)
  if (anime.rating && anime.rating.includes("Rx")) {
    return handleRandomAnime(interaction); // Try again if NSFW content slipped through
  }

  // Send the single result
  await sendAnimeEmbed(interaction, anime);
}

async function handleTopAnime(
  interaction: ChatInputCommandInteraction,
  type: string | null,
) {
  // Build API URL with type filter if specified
  let apiUrl = "https://api.jikan.moe/v4/top/anime?sfw=true&limit=10";
  if (type) {
    apiUrl += `&type=${type}`;
  }

  const response = await fetch(apiUrl);

  if (!response.ok) {
    throw new Error(`Jikan API returned ${response.status}`);
  }

  const data: AnimeResponse = await response.json();

  if (!data.data || data.data.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ Failed to fetch top anime list."),
      ],
    });
    return;
  }

  // Show paginated results
  await showPaginatedResults(interaction, data.data, "top");
}

async function showPaginatedResults(
  interaction: ChatInputCommandInteraction,
  animeList: AnimeResult[],
  mode: "search" | "top",
) {
  let currentPage = 0;

  // Filter out any potentially NSFW content that slipped through
  const safeAnimeList = animeList.filter(
    (anime) => !(anime.rating && anime.rating.includes("Rx")),
  );

  if (safeAnimeList.length === 0) {
    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ff3838")
          .setDescription("❌ No suitable anime found."),
      ],
    });
    return;
  }

  // Create pagination buttons
  const createButtons = (page: number) => {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("prev")
        .setEmoji("◀️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === 0),
      new ButtonBuilder()
        .setCustomId("next")
        .setEmoji("▶️")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(page === safeAnimeList.length - 1),
    );
  };

  // Send the initial anime embed
  const message = await interaction.editReply({
    embeds: [
      createAnimeEmbed(
        safeAnimeList[currentPage],
        currentPage,
        safeAnimeList.length,
      ),
    ],
    components: safeAnimeList.length > 1 ? [createButtons(currentPage)] : [],
  });

  // If only one result, no need for pagination
  if (safeAnimeList.length <= 1) return;

  // Create collector for button interactions
  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 300000, // 5 minutes
  });

  collector.on("collect", async (i) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({
        content: "❌ These buttons aren't for you!",
        ephemeral: true,
      });
      return;
    }

    // Update current page based on button clicked
    if (i.customId === "prev") {
      currentPage = Math.max(0, currentPage - 1);
    } else if (i.customId === "next") {
      currentPage = Math.min(safeAnimeList.length - 1, currentPage + 1);
    }

    // Update the message with the new page
    await i.update({
      embeds: [
        createAnimeEmbed(
          safeAnimeList[currentPage],
          currentPage,
          safeAnimeList.length,
        ),
      ],
      components: [createButtons(currentPage)],
    });
  });

  collector.on("end", async () => {
    try {
      // Remove buttons when time expires
      await message.edit({
        components: [],
      });
    } catch (error) {
      // Message may have been deleted
    }
  });
}

function createAnimeEmbed(
  anime: AnimeResult,
  currentPage: number,
  totalPages: number,
) {
  // Truncate synopsis if it's too long
  let synopsis = anime.synopsis || "No synopsis available.";
  if (synopsis.length > 1024) {
    synopsis = synopsis.substring(0, 1021) + "...";
  }

  // Get studios as a comma-separated string
  const studios =
    anime.studios?.map((studio) => studio.name).join(", ") || "Unknown";

  // Get genres as a comma-separated string
  const genres = anime.genres?.map((genre) => genre.name).join(", ") || "None";

  // Create the embed
  const embed = new EmbedBuilder()
    .setColor("#2E51A2") // MAL blue color
    .setTitle(anime.title || "Unknown Title")
    .setURL(anime.url)
    .setDescription(
      anime.title_english ? `English: ${anime.title_english}` : "",
    )
    .setThumbnail(anime.images?.jpg?.image_url)
    .addFields(
      {
        name: "📊 Rating",
        value: anime.score
          ? `${anime.score}/10 (${anime.scored_by} votes)`
          : "No rating yet",
        inline: true,
      },
      {
        name: "📺 Type",
        value: `${anime.type || "Unknown"} • ${anime.episodes || "?"} episode(s)`,
        inline: true,
      },
      {
        name: "📆 Aired",
        value: anime.aired?.string || "Unknown",
        inline: true,
      },
      {
        name: "📝 Synopsis",
        value: synopsis,
      },
      {
        name: "🎭 Genres",
        value: genres,
        inline: true,
      },
      {
        name: "🎨 Studios",
        value: studios,
        inline: true,
      },
      {
        name: "📊 Status",
        value: anime.status || "Unknown",
        inline: true,
      },
    )
    .setFooter({
      text:
        totalPages > 1
          ? `Anime ${currentPage + 1}/${totalPages} • Rank #${anime.rank || "?"}`
          : `Rank #${anime.rank || "?"} • Popularity #${anime.popularity || "?"}`,
    })
    .setTimestamp();

  // Add image if available
  if (anime.images?.jpg?.large_image_url) {
    embed.setImage(anime.images.jpg.large_image_url);
  }

  return embed;
}

async function sendAnimeEmbed(
  interaction: ChatInputCommandInteraction,
  anime: AnimeResult,
) {
  await interaction.editReply({
    embeds: [createAnimeEmbed(anime, 0, 1)],
  });
}
