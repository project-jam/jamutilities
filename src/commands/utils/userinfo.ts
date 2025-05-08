import {
  ChatInputCommandInteraction,
  Message,
  SlashCommandBuilder,
  EmbedBuilder,
  User,
  GuildMember,
} from "discord.js";
import type { Command } from "../../types/Command";
import { Logger } from "../../utils/logger";
import { getAverageColor } from "fast-average-color-node";
import fetch from "node-fetch";

const formatDate = (d: Date) => `<t:${Math.floor(d.getTime() / 1000)}:F>`;
const getUserBadges = (user: User, member?: GuildMember) => {
  const badges: string[] = [];
  const flags = user.flags?.toArray() || [];
  if (flags.includes("Staff")) badges.push("<:discordstaff:1334862728636006495>");
  if (flags.includes("Partner")) badges.push("<:discordpartner:1334862705613340702>");
  if (flags.includes("Hypesquad")) badges.push("<:hypesquadevents:1334862814233497612>");
  if (flags.includes("HypeSquadOnlineHouse1")) badges.push("<:hypesquadbravery:1334862772663746621>");
  if (flags.includes("HypeSquadOnlineHouse2")) badges.push("<:hypesuqdbrilliance:1334862794176200725>");
  if (flags.includes("HypeSquadOnlineHouse3")) badges.push("<:hypesquadbalance:1334862747179159603>");
  if (flags.includes("BugHunterLevel1")) badges.push("<:discordbughunter1:1334862636034031676>");
  if (flags.includes("BugHunterLevel2")) badges.push("<:discordbughunter2:1334862662122864640>");
  if (flags.includes("VerifiedDeveloper")) badges.push("<:discordbotdev:1334862623526752256>");
  if (flags.includes("PremiumEarlySupporter")) badges.push("<:discordearlysupporter:1334862682343346188>");
  if (flags.includes("ActiveDeveloper")) badges.push("<:activedeveloper:1334862611354877992>");
  if (user.premiumType === 2) badges.push("<:boost15month:1334843946442031165>");
  if (member?.premiumSince) {
    const days = Math.floor((Date.now() - member.premiumSince.getTime()) / (1000 * 60 * 60 * 24));
    badges.push(`Boosting: ${days} days`);
  }
  if (flags.includes("CertifiedModerator")) badges.push("<:discordmod:1334871761598287913>");
  return badges.join(" ") || "None";
};

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Shows information about a user")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User (leave empty for self)").setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName("server_info").setDescription("Show server info").setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt.setName("usrbg").setDescription("Show generated background when no banner").setRequired(false)
    ),

  prefix: { aliases: ["userinfo", "whois", "user"], usage: "[@user] [server:false] [usrbg:false]" },

  async execute(interaction: ChatInputCommandInteraction | Message, isPrefix = false) {
    if (!isPrefix) await (interaction as ChatInputCommandInteraction).deferReply();
    try {
      let target: User;
      let showServer = true;
      let showUsrbg = true;
      let guild = isPrefix
        ? (interaction as Message).guild
        : (interaction as ChatInputCommandInteraction).guild;

      if (isPrefix) {
        const msg = interaction as Message;
        target = msg.mentions.users.first() || msg.author;
        const lc = msg.content.toLowerCase();
        showServer = !lc.includes("server:false");
        if (lc.includes("usrbg:false") || lc.includes("usrbg=0")) showUsrbg = false;
      } else {
        const slash = interaction as ChatInputCommandInteraction;
        target = slash.options.getUser("user") || slash.user;
        showServer = slash.options.getBoolean("server_info") ?? true;
        showUsrbg = slash.options.getBoolean("usrbg") ?? true;
      }

      const fetched = await target.fetch();
      const member = guild?.members.cache.get(target.id);
      const discordBanner = fetched.bannerURL({ size: 4096, dynamic: true });
      const accentHex = fetched.accentColor?.toString(16);
      const usrbgUrl = `https://usrbg.is-hardly.online/usrbg/v2/${target.id}${accentHex ? `?${accentHex}` : ''}`;

      let imageUrl: string | null = null;
      if (discordBanner) {
        imageUrl = discordBanner;
      } else if (showUsrbg) {
        try {
          const res = await fetch(usrbgUrl);
          const ct = res.headers.get("content-type") || "";
          if (res.ok && (ct === "image/gif" || ct.startsWith("image/"))) imageUrl = usrbgUrl;
        } catch {
          // no background
        }
      }

      const embed = new EmbedBuilder().setTitle(`${target.tag}'s Info`);

      if (imageUrl) {
        try {
          const c = await getAverageColor(imageUrl);
          embed.setColor(c.hex);
        } catch {}
      }

      if (showServer && member?.displayAvatarURL()) {
        embed.setThumbnail(member.displayAvatarURL({ size: 4096, dynamic: true }));
      } else {
        embed.setThumbnail(target.displayAvatarURL({ size: 4096, dynamic: true }));
      }

      embed.addFields({
        name: "📑 User Information",
        value: [
          `**Username:** ${target}`,
          `**Tag:** ${target.tag}`,
          `**ID:** ${target.id}`,
          `**Created:** ${formatDate(target.createdAt)}`,
          `**Badges:** ${getUserBadges(target, member)}`,
        ].join("\n"),
      });

      if (showServer && member) {
        const roles = member.roles.cache
          .filter(r => r.id !== guild?.id)
          .sort((a, b) => b.position - a.position)
          .map(r => r.toString());
        embed.addFields({
          name: "🏷️ Server Info",
          value: [
            `**Joined:** ${member.joinedAt ? formatDate(member.joinedAt) : 'Unknown'}`,
            `**Nickname:** ${member.nickname || 'None'}`,
            `**Roles [${roles.length}]:** ${roles.join(', ') || 'None'}`,
          ].join("\n"),
        });
      }

      if (imageUrl) {
        embed.setImage(imageUrl);
        const key = discordBanner ? 'User Banner' : 'Generated Background';
        embed.addFields({ name: `🎨 ${key}`, value: `[Click to view](${imageUrl})` });
      }

      embed.setTimestamp();
      if (isPrefix) await (interaction as Message).reply({ embeds: [embed] });
      else await (interaction as ChatInputCommandInteraction).editReply({ embeds: [embed] });
    } catch (e) {
      Logger.error("userinfo error:", e);
      const ebd = new EmbedBuilder()
        .setColor("#ff3838")
        .setDescription("❌ Failed to fetch info.");
      if (isPrefix) await (interaction as Message).reply({ embeds: [ebd] });
      else await (interaction as ChatInputCommandInteraction).editReply({ embeds: [ebd] });
    }
  },
};
