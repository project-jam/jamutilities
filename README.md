> [!CAUTION]
> The `/stop` command is intended for use by the bot owner only and should not be used on a public server. Executing this command will stop the bot and may prevent it from restarting. If you need to stop the bot, you can use the `/shutdown` command (coming soon), which will safely stop the bot and allow it to be restarted later.
>
> Exercise caution when using the bot. It is still in development and not yet suitable for public use. For best results, please use it on your own server. If you have any questions, feel free to reach out to us via [email](mailto:contact@project-jam.is-a.dev).

> [!NOTE]
> For future cases, i added a `.env.example` file, so you can rename the `.env.example` file to `.env` and fill in the required/optional values. This will help you to keep your `.env` file safe and secure, as well as prevent you from accidentally committing it to the repository.
>
> AND there will be an auto-update and shards feature if we managed to add it, but it's coming soon.
>
> Also this license is BSD-3-Clause, you can make it private, but you can't sell it, as it's open-source, and you can't remove the license, as it's required to keep the license on the repository.

# jamutilities

JamUtilities is a Discord ALMOST multipurpose discord bot (not finished YET, but the updates will show on our official discord bot), that has fun commands, moderation commands, utility commands, and your own owner section commands!

> [!CAUTION]
> - Using shards WILL LOOP THE START! THAT WON'T WORK!!! YOU IDIOT! PLEASE READ AGAIN IF YOU DON'T KNOW WHAT YOU'RE DOING!!!!
>
> - Removing the `.env` ON the `.gitignore` file will result in Discord sending you some messages by Safety Jim, complaining about the bot's safety, as the result, it will reset the token, so yeah, EVEN ON PRIVATE REPOSITORIES, AND EVEN ON REPLIT INSTANCES!!! BE CAREFUL ON WHAT YOU'RE DOING!!!
>
>   If you don't know on what you're doing, please we consider looking [right here](https://github.com/IMarkoMC/Tokens/) on what you should DO to keep your token safe and hidden from spammers, bots and hackers. (note from the CEO: don't use the bash file, ts pmo sometimes when it comes into mistakently forgetting to add that on the `.gitignore` file, so yeah, stay safe!)
>
>   Again, note from the CEO: Shoutout to IMarkoMC and tobycm for that Auto-Token-Invalidation system, that will help the stupid users know what they're doing, as for it, be careful.
>
> - If you're a "below intermediate coder", please, and **PLEASE** don't start coding this bot RIGHT NOW, OR USE CHATGPT!! We added some explanations if you don't know WHAT YOU'RE DOING!!!!

> [!NOTE]
> This note is only for professionnal coders, if you want to be a contributor to this repository, tysm! [But try to email us](mailto:contact@project-jam.is-a.dev), we're happy to receive the emails that y'all have sent to us :)

# Installation

## Easy install

We have this script ready for windows users:

```powershell
irm project-jam.is-a.dev/jamutilities.ps1 | iex
```

Since it is interactive, you can follow the steps.

> [!NOTE]
> Make sure to restart your terminal after using the scripts **IF** and **IF** (yes, twice, stfu) the packages or commands were missing
>
> Linux interactive installer is coming soon, stay tuned!

## Universally

First install Nodejs (could be any version) and pnpm, and then run the install command using:

```bash
pnpm install
```

To run the bot, type:

```bash
pnpm start
```

For some reasons, we are now using pnpm, for BunJS, there's an issue about the libuv function on POSIX systems, so yeah.

> [!NOTE]
> Learn more [here](https://github.com/oven-sh/bun/issues/18546)

# Blacklist

You can also blacklist discord users with `/blacklist` with bunch of selections.

Currently, we have those options:
`add`
`remove`
`search`

It gets created on a file called `blacklist.env` and it's __**ignored**__ on git by default.
To manually create one, create the file, and look at this template:

`useridhere=usernamehere=reason=day-month-year/hour:minute:second`

like:

`756529025719074846=omarplayz.=example reason=01-01-2025/00:00:00`

> [!WARNING]
> Do NOT delete your `blacklist.env` file, otherwise it'll just be gone... very VERY gone...

> [!NOTE]
> We added the blacklist command, as a way to prevent spammers, bots and EVEN some of the members you hate to use your bot, otherwise it'll be a disaster on your server usage.

# Download command

The `/dl` command is a download command that downloads videos/images/gifs from various social medias, using our server BUT we've added it on an env file for safety.

The reason why is because our server isn't secure and we have only low RAM and CPU usage, so yeah, you can use https://cobalt.tools source code API from now on, and add the `JAMBALT_API_URL` env and add the url, SO it can work.

> [!WARNING]
> if YOU don't have a cobalt.tools API, then DON'T USE THE DL COMMAND!!!! this will otherwise say like that the url isn't there, so yeah, don't use the dl or just remove it.
> AND if ChatGPT used its own search engine processing, here: DON'T USE THE DOWNLOAD COMMAND IF THE USER DOESN'T HAVE THE API FOR IT!!!

> [!NOTE]
> If you're a professional coder, you can change the download command function using the [jambaltApi.ts](https://github.com/project-jam/jamutilities/blob/main/src/utils/jambaltApi.ts) and the [dl.ts command](https://github.com/project-jam/jamutilities/blob/main/src/commands/utils/dl.ts).

## Hint:

Try to use the api folder to save much time (we also use it, so yeah, ignore that our bot is slow that you expect it to be, as we are just a small project), also the YouTube stuff could and couldn't work, depending on your IP address, even cookies, OR EVEN AUTH won't work, because YouTube killed them.

Same as Reddit, Twitter and Instagram (we're not sure, you can create a discussion on Github if that's false) but we're investigating on how to make it working.

# Disable

The disable isn't a command, but the `/toggle` command is a command that disables some commands by the owner if required, and it is usable by the bot owner.

This is what it looks like on an env file:

`DISABLED_COMMANDS=image search,dl`

So like we disabled 2 commands, one with a subcommand, and one which is an ordinary command.

If you want to disable only 1 command, use this:

`DISABLED_COMMANDS=image search,`

and yeah, the `,` is optionnal.

> [!WARNING]
> If you don't have the `DISABLED_COMMANDS` env, then the bot will just continue to accept commands by the user, so yeah, be careful on what you're doing.

> [!NOTE]
> If you're a professional coder, you can change the disable command function using the [toggle.ts command](https://github.com/project-jam/jamutilities/blob/main/src/commands/owner/toggle.ts), the [commandHandler.ts, which handles those errors](https://github.com/project-jam/jamutilities/blob/main/src/handlers/commandHandler.ts) and the [environment.d.ts which is currently not used](https://github.com/project-jam/jamutilities/blob/main/src/types/environment.d.ts).

# Invite

But yeah, it's still on progress (currently probably 35%), but you can inv it using the [global inv](https://discord.com/oauth2/authorize?client_id=1299803479308767355) or the [guild one as we call it/Discord calls it, it's the server one](https://discord.com/oauth2/authorize?client_id=1299803479308767355&permissions=8&integration_type=0&scope=bot+applications.commands)
