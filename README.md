# jamutilities

JamUtilities is a discord ALMOST multipurpose discord bot (not finished YET, but the updates will show on our official discord bot), that has fun commands, moderation commands, utility commands, and your own owner section commands!

To install dependencies, install Bun, and then run:

```bash
bun install
```

To run the bot, type:

```bash
bun start
```

For some reasons, we use Bun (https://bun.sh) to speed up the process of installing and starting the app, unlike nodejs and npm/yarn, they're soo slow!

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

# Download command 

The `/dl` command is a download command that downloads videos/images/gifs from our server BUT we added it on an env file for safety.

The reason why is because our server isn't secure and we have only low RAM usage, so yeah, you can use https://cobalt.tools source code API from now on, and add the `JAMBALT_API_URL` env and add the url, SO it can work.

> [!WARNING]
> if YOU don't have a cobalt.tools API, then DON'T USE THE DL COMMAND!!!! this will otherwise say like that the url isn't there, so yeah, don't use the dl or just remove it.

## Hint:

Try to use the api folder to save much time, also the YouTube stuff could and couldn't work, depending on your IP address, even cookies, OR EVEN AUTH won't work, because YouTube killed them.

# Invite

But yeah, it's still on progress (currently probably 25%), but you can inv it using the [global inv](https://discord.com/oauth2/authorize?client_id=1299803479308767355) or the [guild one as we call it, it's the server one](https://discord.com/oauth2/authorize?client_id=1299803479308767355&permissions=8&integration_type=0&scope=bot+applications.commands)
