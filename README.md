# jamutilities

To install dependencies:

```bash
bun install
```

To run:

```bash
bun start
```

For some reasons, we use bun to speed up the process of installing and starting the app, unlike nodejs and npm/yarn.

You can also blacklist discord users with `/blacklist` with bunch of selections

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

But yeah, it's still on work, but you can inv it using the [global inv](https://discord.com/oauth2/authorize?client_id=1299803479308767355) or the [guild one as we call it, it's the server one](https://discord.com/oauth2/authorize?client_id=1299803479308767355&permissions=8&integration_type=0&scope=bot+applications.commands)
