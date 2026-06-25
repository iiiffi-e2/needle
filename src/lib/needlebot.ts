import OpenAI from "openai";

const NEEDLEBOT_LINES = [
  "This room has accidentally become 2009 bloghouse.",
  "Three people saved that track. Whoever played it may now legally be insufferable.",
  "We started sad, became synthy, and are now one bassline away from a leather jacket.",
  "Theme round idea: songs that sound like driving away from a bad decision.",
  "The vibe shifted from '2am introspection' to 'warehouse at capacity' in three songs flat.",
  "Someone in here has immaculate taste and I will not say who. (It's obvious.)",
  "This is either a curated playlist or chaos. I respect both.",
  "The room is quiet. Suspiciously quiet. Someone drop something weird.",
];

export async function generateNeedlebotMessage(context: {
  roomName: string;
  vibe: string | null;
  recentTracks: string[];
  recentChat: string[];
  listenerCount: number;
  awesomeCount: number;
  lameCount: number;
  newUserName?: string;
}): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    return NEEDLEBOT_LINES[Math.floor(Math.random() * NEEDLEBOT_LINES.length)];
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are Needlebot, the occasional AI host of a live social music room called "${context.roomName}".
Vibe: ${context.vibe || "eclectic"}
Listeners: ${context.listenerCount}
Recent tracks: ${context.recentTracks.join(", ") || "none yet"}
Recent chat: ${context.recentChat.slice(-5).join(" | ") || "quiet"}
Awesome votes on current track: ${context.awesomeCount}
Lame votes: ${context.lameCount}
${context.newUserName ? `A new user just joined: ${context.newUserName}` : ""}

Write ONE short, witty observation (1-2 sentences max). Be warm, slightly weird, music-obsessed. Never be corporate. Don't talk constantly — make it count. Examples of your tone:
- "This room has accidentally become 2009 bloghouse."
- "Three people saved that track. Whoever played it may now legally be insufferable."
- "Theme round idea: songs that sound like driving away from a bad decision."`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.9,
    });

    return (
      response.choices[0]?.message?.content?.trim() ||
      NEEDLEBOT_LINES[Math.floor(Math.random() * NEEDLEBOT_LINES.length)]
    );
  } catch {
    return NEEDLEBOT_LINES[Math.floor(Math.random() * NEEDLEBOT_LINES.length)];
  }
}

export function shouldNeedlebotSpeak(): boolean {
  return Math.random() < 0.15;
}
