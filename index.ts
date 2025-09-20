import { Client, type SetActivity } from "@xhayper/discord-rpc";

const clientId = "1416673171339350138";
const apiKey = "4fe5ea349553b84027c2b0d1c950a41f";
const fetchInterval = 2 * 1000;

interface NowPlayingResponse {
  recenttracks?: {
    track?: Array<{
      name: string;
      artist: { "#text": string };
      album: { "#text": string };
      url: string;
      "@attr"?: { nowplaying: string };
    }>;
  };
}

const username = process.argv[2];
if (!username) {
  console.error("Please provide a Last.fm username as a command-line argument.");
  process.exit(1);
}

console.log(`Starting Last.fm presence for user: ${username}`);

const rpc = new Client({ clientId, transport: { type: "ipc" } });
let lastTrackHash: string | undefined;

function getNowPlayingUrl(user: string): string {
  return `https://ws.audioscrobbler.com/2.0/?method=user.getrecenttracks&user=${user}&api_key=${apiKey}&limit=1&format=json`;
}

function getUserAvatarUrl(user: string): string {
  return `http://ws.audioscrobbler.com/2.0/?method=user.getinfo&user=${user}&api_key=${apiKey}&format=json`;
}

let userAvatarUrl: string | undefined;

async function fetchUserAvatar() {
  try {
    const response = await fetch(getUserAvatarUrl(username!));
    if (!response.ok) {
      console.error(`Error fetching user info from Last.fm: ${response.statusText}`);
      return;
    }

    const data = await response.json();
    userAvatarUrl = data?.user?.image?.[3]["#text"];

    if (!userAvatarUrl) {
      console.warn("No avatar URL found for user.");
      return;
    }
    console.log(`Fetched user avatar URL: ${userAvatarUrl}`);
  } catch (error) {
    console.error("Error fetching user avatar:", error);
  }
}

async function updatePresence() {
  let data: NowPlayingResponse | undefined;

  try {
    const response = await fetch(getNowPlayingUrl(username!));

    if (!response.ok) {
      console.error(`Error fetching from Last.fm: ${response.statusText}`);

      rpc.user?.clearActivity();
      lastTrackHash = undefined;
      return;
    }
    data = (await response.json()) as typeof data;
  } catch (error) {
    console.error("Error updating presence:", error);

    rpc.user?.clearActivity();
    lastTrackHash = undefined;
    return;
  }

  const track = data?.recenttracks?.track?.[0];

  const isNowPlaying = track && track["@attr"]?.nowplaying === "true";

  if (!isNowPlaying || !track) {
    if (lastTrackHash !== undefined) {
      console.log("No track is currently playing. Clearing activity.");
      rpc.user?.clearActivity();
      lastTrackHash = undefined;
    }
    return;
  }

  const { name: trackName, artist, album } = track;
  const artistName = artist["#text"];
  const albumName = album["#text"];

  const trackHash = `${artistName}-${trackName}-${albumName}`;
  if (trackHash === lastTrackHash) {
    return;
  }
  lastTrackHash = trackHash;

  console.log(`Now playing: ${artistName} - ${trackName}`);

  const activity: SetActivity = {
    details: trackName,
    state: `by ${artistName}`,
    type: 2,
    startTimestamp: new Date(),
    largeImageText: "Listening on Last.fm",
    largeImageKey: "lastfm",
    smallImageText: `Listening as ${username}`,
    smallImageKey: "music2",
    instance: false,
  };

  if (albumName) {
    activity.largeImageText = `on ${albumName}`;
  }

  try {
    rpc.user?.setActivity(activity);
  } catch (error) {
    console.error("Error updating presence:", error);

    rpc.user?.clearActivity();
    lastTrackHash = undefined;
  }
}

rpc.on("ready", async () => {
  console.log(`Discord RPC connected. Authenticated as ${rpc.user?.username}.`);
  console.log(`Starting Last.fm presence for user: ${username}`);

  // await fetchUserAvatar();

  updatePresence();
  setInterval(updatePresence, fetchInterval);

  eep = false;
});

rpc.on("disconnected", () => {
  console.warn("Discord RPC disconnected. Attempting to reconnect...");
});

rpc.on("error", (error) => {
  if (!eep) console.error("Discord RPC error:", error);
  eep = true;
});

rpc.on("close", () => {
  console.warn("Discord RPC connection closed. Attempting to reconnect...");
});

rpc.on("debug", (message) => {
  // console.debug("Discord RPC debug:", message);
});

let eep = false;

while (true) {
  try {
    await rpc.login();
    await new Promise<void>((resolve) => rpc.once("disconnected", () => resolve()));
  } catch (error) {
    if (!eep) console.error("Error connecting to Discord RPC:", error);
    eep = true;
  }
}
