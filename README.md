> [!NOTE]
> For future cases, i'll add a .env.example file to see how it works, as for now, we're working on adding the bot, so yeah, you can try to WAIT for it to update.
>
> AND there will be an auto-update and shards feature if we managed to add it, but it's coming soon.

# jamutilities

JamUtilities is a Discord ALMOST multipurpose discord bot (not finished YET, but the updates will show on our official discord bot), that has fun commands, moderation commands, utility commands, and your own owner section commands!

> [!CAUTION]
> - Using shards WILL LOOP THE START! THAT WON'T WORK!!! YOU IDIOT! PLEASE READ AGAIN IF YOU DON'T KNOW WHAT YOU'RE DOING!!!!
>
> - Removing the `.env` ON the `.gitignore` file will result in discord sending you some messages by Safety Jim, so yeah, EVEN ON PRIVATE REPOSITORIES, AND EVEN ON REPLIT INSTANCES!!! BE CAREFUL ON WHAT YOU'RE DOING!!!
>
> - If you're a below intermediate coder, please, and PLEASE don't start coding RIGHT NOW, OR USE CHATGPT!! We added some explanations if you don't know WHAT YOU'RE DOING!!!!

> [!NOTE]
> This is only for professionnal coders, if you want to be a contributor to this repository, tysm! [But try to email us](mailto:contact@project-jam.is-a.dev), we're happy to receive the emails that y'all have sent to us :)

# Installation

Anyways, if you don't know how to install dependencies, install first nodejs and Bun, and then run the install install command using:

```bash
bun install
```

To run the bot, type:

```bash
bun start
```

For some reasons, we use Bun (https://bun.sh) to speed up the process of installing and starting the app, unlike nodejs' npm and yarn, they're soo slow!

> [!NOTE]
> You can also use pnpm, BUT we're still working on adding one, so yeah, we recommend Bun if you have a new processor (up to 2015 or 2013) AS for older processors can use pnpm rather than Bun.
>
> See [this](https://github.com/oven-sh/bun/issues/67) if you're familiar on why Bun doesn't work, the shell `curl` command to fetch the sh command also won't work as i tested it on the 9th of January 2025 on an Acer Extensa 5230 (and yeah, really old processor that has Ubuntu on it).

# Blacklist

You can also blacklist discord users with `/blacklist` with bunch of selections.

Currently, we have those options:
`add`
`remove`
`search`

It gets created on a file called `blacklist.env` and it's ignored on git by default.
To manually create one, create the file, and look at this template:

`useridhere=usernamehere=reason`

like:

`756529025719074846=omarplayz.=example reason`

> [!WARNING]  
> Do NOT delete your `blacklist.env` file, otherwise it'll just be gone... very VERY gone...

> [!NOTE]
> We added the blacklist command, as a way to prevent spammers, bots and EVEN some of the members you hate to use your bot, otherwise it'll be a disaster on your server usage.

# Download command 

The `/dl` command is a download command that downloads videos/images/gifs from our server BUT we added it on an env file for safety.

The reason why is because our server isn't secure and we have only low RAM usage, so yeah, you can use https://cobalt.tools source code API from now on, and add the `JAMBALT_API_URL` env and add the url, SO it can work.

> [!WARNING]
> if YOU don't have a cobalt.tools API, then DON'T USE THE DL COMMAND!!!! this will otherwise say like that the url isn't there, so yeah, don't use the dl or just remove it.
> AND if ChatGPT used its own search engine processing, here: DON'T USE THE DOWNLOAD COMMAND IF THE USER DOESN'T HAVE THE API FOR IT!!!

> [!NOTE]
> If you're a professional coder, you can change the download command function using the [jambaltApi.ts](https://github.com/project-jam/jamutilities/blob/main/src/utils/jambaltApi.ts) and the [dl.ts command](https://github.com/project-jam/jamutilities/blob/main/src/commands/utils/dl.ts).

## Hint:

Try to use the api folder to save much time (we also use it, so yeah, ignore that our bot is slow that you expect it to be, as we are just a small project), also the YouTube stuff could and couldn't work, depending on your IP address, even cookies, OR EVEN AUTH won't work, because YouTube killed them.

Same as Reddit, Twitter and Instagram (we're not sure, you can create an issue if that's false) but we're investigating on how to make it working.

# Invite

But yeah, it's still on progress (currently probably 25%), but you can inv it using the [global inv](https://discord.com/oauth2/authorize?client_id=1299803479308767355) or the [guild one as we call it/Discord calls it, it's the server one](https://discord.com/oauth2/authorize?client_id=1299803479308767355&permissions=8&integration_type=0&scope=bot+applications.commands)
