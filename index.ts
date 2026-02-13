import { parseArgs } from "util";

import { Client, type SetActivity } from "@xhayper/discord-rpc";

import YouTube from "youtube-sr";

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

const args = parseArgs({
  args: process.argv,
  options: {
    username: { type: "string", short: "u" },
  },
  allowPositionals: true,
});

const username = args.values.username;
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

async function getItunesArtwork(artist: string, track: string) {
  try {
    const query = encodeURIComponent(`${artist} - ${track}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=1`);
    const data = (await res.json()) as { resultCount: number; results: { artworkUrl100: string }[] };

    if (data.resultCount > 0) {
      // iTunes returns a 100x100 url, but we can hack it to get high-res
      return data.results[0]?.artworkUrl100.replace("100x100bb", "1000x1000bb");
    }
  } catch (e) {
    return null;
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

  let albumArt = await getItunesArtwork(artistName, trackName);

  if (!albumArt) {
    try {
      const results = await YouTube.searchOne(`${artistName} - ${trackName}`, "video");
      albumArt = results.thumbnail?.url;
    } catch (error) {
      console.error("Error fetching album art from YouTube:", error);
    }
  }

  const activity: SetActivity = {
    details: trackName,
    state: `by ${artistName}`,
    type: 2,
    startTimestamp: new Date(),
    largeImageText: "Listening on Last.fm",
    largeImageKey: albumArt || "lastfm",
    smallImageText: `Listening as ${username}`,
    smallImageKey: "https://emoji.slack-edge.com/T09V59WQY1E/edm/4297d1ba1b50c05b.gif",
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
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}
