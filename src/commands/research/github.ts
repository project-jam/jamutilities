import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  language: string;
  topics: string[];
  default_branch: string;
  created_at: string;
  updated_at: string;
  owner: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  license?: {
    name: string;
    url: string;
  };
}

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  company: string | null;
  email: string | null;
  hireable: boolean | null;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("Get information about GitHub repositories and users")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("repo")
        .setDescription("Get information about a GitHub repository")
        .addStringOption((option) =>
          option
            .setName("repository")
            .setDescription('Repository name (e.g., "username/repository")')
            .setRequired(true),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("user")
        .setDescription("Get information about a GitHub user")
        .addStringOption((option) =>
          option
            .setName("username")
            .setDescription("GitHub username")
            .setRequired(true),
        ),
    ),

  // Add prefix command configuration
  prefix: {
    aliases: ["github", "gh"],
    usage: "<repo/user> <name>", // Example: jam!gh repo username/repo
  },

  async execute(
    interaction: ChatInputCommandInteraction | Message,
    isPrefix = false,
  ) {
    try {
      let subcommand: string;
      let searchTerm: string;

      if (isPrefix) {
        const args = (interaction as Message).content
          .slice(process.env.PREFIX?.length || 0)
          .trim()
          .split(/ +/g)
          .slice(1);

        if (args.length < 2) {
          await (interaction as Message).reply({
            embeds: [
              new EmbedBuilder()
                .setColor("#ff3838")
                .setDescription(
                  "❌ Please provide both a subcommand and search term!",
                )
                .addFields({
                  name: "Usage",
                  value: [
                    `${process.env.PREFIX || "jam!"}github <repo/user> <name>`,
                    "",
                    "Examples:",
                    `${process.env.PREFIX || "jam!"}gh repo username/repository`,
                    `${process.env.PREFIX || "jam!"}github user username`,
                  ].join("\n"),
                }),
            ],
          });
          return;
        }

        subcommand = args[0].toLowerCase();
        searchTerm = args.slice(1).join(" ");
        await (interaction as Message).channel.sendTyping();
      } else {
        await (interaction as ChatInputCommandInteraction).deferReply();
        subcommand = (
          interaction as ChatInputCommandInteraction
        ).options.getSubcommand();
        searchTerm = (
          interaction as ChatInputCommandInteraction
        ).options.getString(
          subcommand === "repo" ? "repository" : "username",
          true,
        );
      }

      switch (subcommand) {
        case "repo":
          await handleRepoLookup(searchTerm, interaction, isPrefix);
          break;
        case "user":
          await handleUserLookup(searchTerm, interaction, isPrefix);
          break;
        default:
          const errorEmbed = new EmbedBuilder()
            .setColor("#ff3838")
            .setDescription("❌ Invalid subcommand. Use 'repo' or 'user'.");

          if (isPrefix) {
            await (interaction as Message).reply({ embeds: [errorEmbed] });
          } else {
            await (interaction as ChatInputCommandInteraction).editReply({
              embeds: [errorEmbed],
            });
          }
      }
    } catch (error) {
      Logger.error("GitHub command failed:", error);
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription(
          "❌ An error occurred while fetching GitHub information.",
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

async function handleRepoLookup(
  repo: string,
  interaction: ChatInputCommandInteraction | Message,
  isPrefix: boolean,
) {
  if (!repo.includes("/")) {
    const errorEmbed = new EmbedBuilder()
      .setColor("#ff3838")
      .setDescription(
        '❌ Please provide the repository in the format "username/repository"',
      );

    if (isPrefix) {
      await (interaction as Message).reply({ embeds: [errorEmbed] });
    } else {
      await (interaction as ChatInputCommandInteraction).editReply({
        embeds: [errorEmbed],
      });
    }
    return;
  }

  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Discord-Bot",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Repository not found!");

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [notFoundEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [notFoundEmbed],
        });
      }
      return;
    }
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data: GitHubRepo = await response.json();

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(data.full_name)
    .setURL(data.html_url)
    .setDescription(data.description || "No description provided")
    .setThumbnail(data.owner.avatar_url)
    .addFields(
      {
        name: "📊 Statistics",
        value: [
          `⭐ Stars: ${data.stargazers_count.toLocaleString()}`,
          `🔀 Forks: ${data.forks_count.toLocaleString()}`,
          `⚠️ Issues: ${data.open_issues_count.toLocaleString()}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "💻 Details",
        value: [
          `📝 Language: ${data.language || "Not specified"}`,
          `🌿 Default Branch: ${data.default_branch}`,
          `📜 License: ${data.license?.name || "Not specified"}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "⏰ Timestamps",
        value: [
          `Created: <t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`,
          `Updated: <t:${Math.floor(new Date(data.updated_at).getTime() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
    )
    .setFooter({
      text: `Owner: ${data.owner.login}`,
      iconURL: data.owner.avatar_url,
    })
    .setTimestamp();

  if (data.topics && data.topics.length > 0) {
    embed.addFields({
      name: "🏷️ Topics",
      value: data.topics.map((topic) => `\`${topic}\``).join(", "),
      inline: false,
    });
  }

  if (isPrefix) {
    await (interaction as Message).reply({ embeds: [embed] });
  } else {
    await (interaction as ChatInputCommandInteraction).editReply({
      embeds: [embed],
    });
  }
}

async function handleUserLookup(
  username: string,
  interaction: ChatInputCommandInteraction | Message,
  isPrefix: boolean,
) {
  const response = await fetch(`https://api.github.com/users/${username}`, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Discord-Bot",
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      const notFoundEmbed = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ User not found!");

      if (isPrefix) {
        await (interaction as Message).reply({ embeds: [notFoundEmbed] });
      } else {
        await (interaction as ChatInputCommandInteraction).editReply({
          embeds: [notFoundEmbed],
        });
      }
      return;
    }
    throw new Error(`GitHub API returned ${response.status}`);
  }

  const data: GitHubUser = await response.json();

  const embed = new EmbedBuilder()
    .setColor("#2b2d31")
    .setTitle(data.name || data.login)
    .setURL(data.html_url)
    .setDescription(data.bio || "No bio provided")
    .setThumbnail(data.avatar_url)
    .addFields(
      {
        name: "📊 Statistics",
        value: [
          `📚 Repositories: ${data.public_repos.toLocaleString()}`,
          `📝 Gists: ${data.public_gists.toLocaleString()}`,
          `👥 Followers: ${data.followers.toLocaleString()}`,
          `👤 Following: ${data.following.toLocaleString()}`,
        ].join("\n"),
        inline: true,
      },
      {
        name: "📌 Profile",
        value:
          [
            data.company ? `🏢 ${data.company}` : null,
            data.location ? `📍 ${data.location}` : null,
            data.email ? `📧 ${data.email}` : null,
            data.blog ? `🌐 [Website](${data.blog})` : null,
            data.twitter_username
              ? `🐦 [@${data.twitter_username}](https://twitter.com/${data.twitter_username})`
              : null,
            data.hireable ? "✅ Available for hire" : null,
          ]
            .filter(Boolean)
            .join("\n") || "No additional information provided",
        inline: true,
      },
      {
        name: "⏰ Timestamps",
        value: [
          `Joined: <t:${Math.floor(new Date(data.created_at).getTime() / 1000)}:R>`,
          `Updated: <t:${Math.floor(new Date(data.updated_at).getTime() / 1000)}:R>`,
        ].join("\n"),
        inline: true,
      },
    )
    .setFooter({
      text: `GitHub User: ${data.login}`,
      iconURL: data.avatar_url,
    })
    .setTimestamp();

  if (isPrefix) {
    await (interaction as Message).reply({ embeds: [embed] });
  } else {
    await (interaction as ChatInputCommandInteraction).editReply({
      embeds: [embed],
    });
  }
}
