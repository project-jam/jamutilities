import {
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    EmbedBuilder,
} from "discord.js";
import type { Command } from "../../types/Command";

export const command: Command = {
    data: new SlashCommandBuilder()
        .setName("pokemon")
        .setDescription(
            "Fetches detailed information about a Pokémon from PokeAPI",
        )
        .addStringOption((option) =>
            option
                .setName("name")
                .setDescription("The name or ID of the Pokémon")
                .setRequired(true),
        )
        .setDMPermission(true),

    prefix: {
        aliases: ["pokemon", "pokedex", "pkmn"],
        usage: "<pokemon name or ID>",
    },

    async execute(
        interaction: ChatInputCommandInteraction | Message,
        isPrefix = false,
    ) {
        let pokemonIdentifier: string;

        // Get the Pokémon name or ID from the interaction
        if (isPrefix) {
            const args = (interaction as Message).content.split(/\s+/).slice(1);
            if (args.length === 0) {
                // Sending error as an embed
                const errorEmbed = new EmbedBuilder()
                    .setTitle("❌ Error")
                    .setDescription("Please provide a Pokémon name or ID.")
                    .setColor("#ff0000"); // Red color for errors
                await (interaction as Message).reply({ embeds: [errorEmbed] });
                return;
            }
            // Join arguments with hyphen for multi-word names (like 'mr-mime')
            pokemonIdentifier = args.join("-").toLowerCase();
        } else {
            pokemonIdentifier = (
                interaction as ChatInputCommandInteraction
            ).options
                .getString("name", true)
                .toLowerCase();
        }

        try {
            // Defer reply for Slash Commands
            if (!isPrefix) {
                await (interaction as ChatInputCommandInteraction).deferReply();
            }

            // Fetch Pokémon data from PokeAPI
            const apiUrl = `https://pokeapi.co/api/v2/pokemon/${pokemonIdentifier}`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                if (response.status === 404) {
                    // Throw a specific error for 404 to be caught below
                    throw new Error(
                        `Pokémon "${pokemonIdentifier}" not found. Please check the spelling.`,
                    );
                }
                throw new Error(`API returned status ${response.status}`);
            }

            const pokemonData = await response.json();

            // Fetch Species data for Egg Groups and Gender
            const speciesResponse = await fetch(pokemonData.species.url);
            // Check if species fetch was successful
            if (!speciesResponse.ok) {
                console.error(
                    "Failed to fetch species data:",
                    speciesResponse.status,
                );
                // Continue without species data if fetch fails
            }
            const speciesData = speciesResponse.ok
                ? await speciesResponse.json()
                : null;

            // Fetch Location Encounters data
            let locationAreas = "No location data available.";
            if (pokemonData.location_area_encounters) {
                const locationResponse = await fetch(
                    pokemonData.location_area_encounters,
                );
                if (locationResponse.ok) {
                    const locationData = await locationResponse.json();
                    if (locationData.length > 0) {
                        // Limit to the first few locations to avoid very long fields
                        const locationsToList = 5;
                        locationAreas = locationData
                            .slice(0, locationsToList)
                            .map((area: any) =>
                                area.location_area.name
                                    .replace(/-/g, " ")
                                    .split(" ")
                                    .map(
                                        (word: string) =>
                                            word.charAt(0).toUpperCase() +
                                            word.slice(1),
                                    )
                                    .join(" "),
                            )
                            .join(", ");
                        if (locationData.length > locationsToList) {
                            locationAreas += `, ... (${locationData.length} total)`;
                        }
                    } else {
                        locationAreas =
                            "No specific encounter locations listed.";
                    }
                } else {
                    console.error(
                        "Failed to fetch location data:",
                        locationResponse.status,
                    );
                    locationAreas = "Could not retrieve location data.";
                }
            }

            // Extract and format data
            const name =
                pokemonData.name.charAt(0).toUpperCase() +
                pokemonData.name.slice(1).replace(/-/g, " "); // Capitalize and format name
            const id = pokemonData.id;

            const types = pokemonData.types
                .map(
                    (typeInfo: any) =>
                        typeInfo.type.name.charAt(0).toUpperCase() +
                        typeInfo.type.name.slice(1),
                )
                .join(", ");

            const abilities = pokemonData.abilities
                .map((abilityInfo: any) => {
                    const abilityName = abilityInfo.ability.name
                        .replace(/-/g, " ")
                        .split(" ")
                        .map(
                            (word: string) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ");
                    return abilityInfo.is_hidden
                        ? `${abilityName} (Hidden)`
                        : abilityName;
                })
                .join(", ");

            // Convert height from decimeters to meters and weight from hectograms to kilograms
            const heightMeters = (pokemonData.height / 10).toFixed(1);
            const weightKilograms = (pokemonData.weight / 10).toFixed(1);

            // Format stats
            const stats = pokemonData.stats
                .map((statInfo: any) => {
                    const statName = statInfo.stat.name
                        .replace("special-attack", "Sp. Atk")
                        .replace("special-defense", "Sp. Def")
                        .replace(/-/g, " ")
                        .split(" ")
                        .map(
                            (word: string) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" ");
                    return `${statName}: ${statInfo.base_stat}`;
                })
                .join("\n");

            // Format Egg Groups
            const eggGroups = speciesData
                ? speciesData.egg_groups
                      .map(
                          (groupInfo: any) =>
                              groupInfo.name.charAt(0).toUpperCase() +
                              groupInfo.name.slice(1),
                      )
                      .join(", ")
                : "N/A";

            // Format Gender Ratio (gender_rate: -1 = genderless, 0 = 100% male, 8 = 100% female, 1-7 = male/female ratio)
            let genderRatio = "N/A";
            if (speciesData) {
                if (speciesData.gender_rate === -1) {
                    genderRatio = "Genderless";
                } else {
                    const femaleChance = (speciesData.gender_rate / 8) * 100;
                    const maleChance = 100 - femaleChance;
                    genderRatio = `♂️ ${maleChance}% | ♀️ ${femaleChance}%`;
                }
            }

            // List first few moves (to avoid very long embeds)
            const movesToList = 5;
            const moves = pokemonData.moves
                .slice(0, movesToList)
                .map((moveInfo: any) =>
                    moveInfo.move.name
                        .replace(/-/g, " ")
                        .split(" ")
                        .map(
                            (word: string) =>
                                word.charAt(0).toUpperCase() + word.slice(1),
                        )
                        .join(" "),
                )
                .join(", ");
            const totalMoves = pokemonData.moves.length;
            const movesText =
                totalMoves > 0
                    ? `${moves}${totalMoves > movesToList ? `, ... (${totalMoves} total)` : ""}`
                    : "No moves listed.";

            // List forms
            const forms = pokemonData.forms
                .map(
                    (formInfo: any) =>
                        formInfo.name.charAt(0).toUpperCase() +
                        formInfo.name.slice(1).replace(/-/g, " "),
                )
                .join(", ");

            // Use official artwork if available, otherwise fallback to front_default
            const imageUrl =
                pokemonData.sprites.other?.["official-artwork"]
                    ?.front_default || pokemonData.sprites.front_default;
            const thumbnailUrl = pokemonData.sprites.front_default; // Keep default sprite for thumbnail

            // Create the embed
            const embed = new EmbedBuilder()
                .setTitle(`${name} (#${id})`)
                .setURL(
                    `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(pokemonData.name)}_(Pok%C3%A9mon)`,
                ) // Link to Bulbapedia
                .addFields(
                    { name: "Type(s)", value: types, inline: true },
                    { name: "Abilities", value: abilities, inline: true },
                    {
                        name: "Height",
                        value: `${heightMeters} m`,
                        inline: true,
                    },
                    {
                        name: "Weight",
                        value: `${weightKilograms} kg`,
                        inline: true,
                    },
                    { name: "Egg Groups", value: eggGroups, inline: true },
                    { name: "Gender Ratio", value: genderRatio, inline: true },
                    { name: "Forms", value: forms || "None", inline: false }, // Display forms
                    {
                        name: "Base Stats",
                        value: `\`\`\`\n${stats}\n\`\`\``,
                        inline: false,
                    }, // Use code block for stats
                    {
                        name: `Moves (First ${movesToList})`,
                        value: movesText,
                        inline: false,
                    },
                    {
                        name: "Encounter Locations",
                        value: locationAreas,
                        inline: false,
                    }, // Add location areas
                )
                .setTimestamp()
                .setColor("#FF0000"); // Consider dynamic color based on type

            if (imageUrl) {
                embed.setImage(imageUrl); // Set the main image
            }
            if (thumbnailUrl) {
                embed.setThumbnail(thumbnailUrl); // Set the thumbnail
            }

            // Reply or edit the deferred reply with the embed
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [embed] });
            } else {
                await (interaction as ChatInputCommandInteraction).editReply({
                    embeds: [embed],
                });
            }
        } catch (error: any) {
            console.error("Error fetching Pokémon data:", error);

            // Create an embed for the error message
            const errorEmbed = new EmbedBuilder()
                .setTitle("❌ Error Fetching Pokémon Data")
                .setDescription(
                    `Failed to fetch Pokémon data: ${error.message}`,
                )
                .setColor("#ff0000"); // Red color for errors

            // Send the error embed
            if (isPrefix) {
                await (interaction as Message).reply({ embeds: [errorEmbed] });
            } else {
                // Attempt to edit the reply if it was deferred, otherwise send a follow-up
                try {
                    await (
                        interaction as ChatInputCommandInteraction
                    ).editReply({ embeds: [errorEmbed] });
                } catch (e) {
                    // If deferReply wasn't successful or reply already sent, send a follow-up
                    await (interaction as ChatInputCommandInteraction).followUp(
                        { embeds: [errorEmbed], ephemeral: true },
                    );
                }
            }
        }
    },
};
