import { mkdir, writeFile } from 'node:fs/promises';

const clientId = process.env.TWITCH_CLIENT_ID;
const clientSecret = process.env.TWITCH_CLIENT_SECRET;
const channelLogin = process.env.TWITCH_CHANNEL_LOGIN;
const outputPath = 'data/twitch.json';

async function writeOutput(payload) {
  await mkdir('data', { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function fallbackPayload(extra = {}) {
  return {
    available: false,
    channelLogin: channelLogin || null,
    fetchedAt: new Date().toISOString(),
    ...extra
  };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function getAppAccessToken() {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials'
  });

  const response = await fetch(`https://id.twitch.tv/oauth2/token?${params.toString()}`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error(`OAuth token request failed with ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function helix(path, accessToken) {
  return fetchJson(`https://api.twitch.tv/helix/${path}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Client-Id': clientId
    }
  });
}

async function main() {
  if (!clientId || !clientSecret || !channelLogin) {
    await writeOutput(fallbackPayload({ reason: 'missing_env' }));
    return;
  }

  try {
    const accessToken = await getAppAccessToken();
    const usersData = await helix(`users?login=${encodeURIComponent(channelLogin)}`, accessToken);
    const user = usersData.data?.[0];

    if (!user) {
      await writeOutput(fallbackPayload({ reason: 'channel_not_found' }));
      return;
    }

    const streamsData = await helix(`streams?user_login=${encodeURIComponent(channelLogin)}`, accessToken);
    const liveStream = streamsData.data?.[0];

    if (liveStream) {
      await writeOutput({
        available: true,
        isLive: true,
        channelLogin,
        channelDisplayName: user.display_name,
        userId: user.id,
        title: liveStream.title,
        category: liveStream.game_name || null,
        viewerCount: liveStream.viewer_count ?? null,
        startedAt: liveStream.started_at,
        fetchedAt: new Date().toISOString()
      });
      return;
    }

    const archivesData = await helix(`videos?user_id=${encodeURIComponent(user.id)}&type=archive&first=1`, accessToken);
    const latestArchive = archivesData.data?.[0];

    let video = latestArchive;
    if (!video) {
      const anyVideosData = await helix(`videos?user_id=${encodeURIComponent(user.id)}&first=1`, accessToken);
      video = anyVideosData.data?.[0];
    }

    await writeOutput({
      available: Boolean(video),
      isLive: false,
      channelLogin,
      channelDisplayName: user.display_name,
      userId: user.id,
      videoId: video?.id ?? null,
      title: video?.title ?? null,
      publishedAt: video?.published_at ?? null,
      duration: video?.duration ?? null,
      fetchedAt: new Date().toISOString(),
      reason: video ? null : 'no_videos'
    });
  } catch (error) {
    await writeOutput(fallbackPayload({
      reason: 'fetch_failed',
      error: error instanceof Error ? error.message : String(error)
    }));
    process.exitCode = 1;
  }
}

await main();
