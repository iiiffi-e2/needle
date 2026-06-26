export const CROWD_COLORS = [
  "#ff7a59",
  "#ffd166",
  "#5ad1c8",
  "#8a7bff",
  "#ff6fae",
  "#7ed957",
  "#ffa94d",
  "#56b9ff",
] as const;

export const HERO_BEAMS = [
  { x: "380px", dur: "5.5s", delay: "0s" },
  { x: "620px", dur: "6.4s", delay: ".7s" },
  { x: "820px", dur: "4.8s", delay: ".3s" },
  { x: "1060px", dur: "6s", delay: ".5s" },
] as const;

const cspec = [
  { x: 592, b: 62, s: 34, c: 2, react: false as const },
  { x: 836, b: 64, s: 34, c: 5, react: false as const },
  { x: 512, b: 30, s: 46, c: 6, react: false as const },
  { x: 908, b: 34, s: 44, c: 1, react: true as const, g: "♪" },
  { x: 548, b: 6, s: 60, c: 4, react: true as const, g: "♥" },
  { x: 884, b: 8, s: 56, c: 3, react: false as const },
];

export const HERO_CROWD = cspec.map((a, i) => {
  const color = CROWD_COLORS[a.c];
  return {
    wrap: {
      position: "absolute" as const,
      bottom: `${a.b}px`,
      left: `${a.x}px`,
      width: `${a.s}px`,
      zIndex: 10 + Math.round(a.s),
    },
    body: {
      width: `${a.s}px`,
      height: `${Math.round(a.s * 1.04)}px`,
      borderRadius: "46% 46% 42% 42% / 54% 54% 46% 46%",
      background: `radial-gradient(circle at 38% 26%, #ffffff70, #ffffff00 46%), ${color}`,
      boxShadow: "0 10px 22px #000a, inset 0 -6px 12px #00000040",
      animation: `${i % 2 ? "ndl-wobble" : "ndl-bob"} ${(1.7 + i * 0.2).toFixed(2)}s ease-in-out infinite ${(i * 0.18).toFixed(2)}s`,
    },
    react: a.react,
    glyph: "g" in a ? a.g : "",
    color,
    rdur: `${(2.4 + i * 0.3).toFixed(2)}s`,
    rdelay: `${(i * 0.4).toFixed(2)}s`,
  };
});

const fspec = [
  { x: 120, y: 120, s: 46, c: 3 },
  { x: 300, y: 520, s: 60, c: 0 },
  { x: 560, y: 200, s: 38, c: 2 },
  { x: 1180, y: 600, s: 54, c: 4 },
  { x: 1000, y: 120, s: 42, c: 5 },
  { x: 680, y: 680, s: 50, c: 1 },
];

function mkFloatBlob(a: (typeof fspec)[number], i: number) {
  const color = CROWD_COLORS[a.c];
  const body = {
    width: `${a.s}px`,
    height: `${Math.round(a.s * 1.04)}px`,
    borderRadius: "46% 46% 42% 42% / 54% 54% 46% 46%",
    background: `radial-gradient(circle at 38% 26%, #ffffff7a, #ffffff00 46%), ${color}`,
    boxShadow: "0 12px 26px #000a",
    opacity: 0.65,
  };
  const anim = `ndl-float ${(5 + i * 0.7).toFixed(1)}s ease-in-out infinite ${(i * 0.5).toFixed(1)}s`;
  return {
    body,
    wrap: {
      position: "absolute" as const,
      top: `${a.y}px`,
      left: `${a.x}px`,
      zIndex: 4,
      animation: anim,
    },
    wrapFoot: {
      position: "absolute" as const,
      top: `${(a.y % 420) + 30}px`,
      left: `${a.x}px`,
      zIndex: 2,
      animation: anim,
    },
  };
}

export const FLOAT_BLOBS = fspec.map(mkFloatBlob);

const mkBlobs = (base: { b: string; l: string; s: string; c: number }[]) =>
  base.map((b, i) => ({
    b: b.b,
    l: b.l,
    s: b.s,
    c: CROWD_COLORS[b.c],
    d: `${(1.8 + i * 0.3).toFixed(1)}s`,
  }));

export const LANDING_ROOMS = [
  {
    slug: "the-first-room-ever",
    name: "The FIRST Room Ever",
    track: "Midnight Pretenders — Tomoko Aran",
    count: "9",
    tag: "city pop",
    bg: "radial-gradient(120% 90% at 50% 0%, #2a1709, #100a06)",
    glow: "#ff9d3c",
    stage: "#ff9d3c33",
    dj: "#ff7a59",
    blobs: mkBlobs([
      { b: "14px", l: "34px", s: "18px", c: 2 },
      { b: "8px", l: "120px", s: "22px", c: 4 },
      { b: "18px", l: "190px", s: "16px", c: 3 },
    ]),
  },
  {
    slug: "3am-yacht-rock",
    name: "3AM Yacht Rock",
    track: "Sailing — Christopher Cross",
    count: "14",
    tag: "smooth",
    bg: "radial-gradient(120% 90% at 50% 0%, #0c1c2a, #0a0f16)",
    glow: "#56b9ff",
    stage: "#56b9ff33",
    dj: "#56b9ff",
    blobs: mkBlobs([
      { b: "12px", l: "40px", s: "20px", c: 5 },
      { b: "20px", l: "150px", s: "16px", c: 1 },
      { b: "8px", l: "200px", s: "22px", c: 7 },
    ]),
  },
  {
    slug: "goblin-mode-fm",
    name: "Goblin Mode FM",
    track: "Lid — Aphex Twin",
    count: "22",
    tag: "unhinged",
    bg: "radial-gradient(120% 90% at 50% 0%, #1c0c2a, #120a18)",
    glow: "#a98bff",
    stage: "#a98bff33",
    dj: "#8a7bff",
    blobs: mkBlobs([
      { b: "16px", l: "36px", s: "18px", c: 4 },
      { b: "6px", l: "130px", s: "24px", c: 6 },
      { b: "22px", l: "195px", s: "14px", c: 2 },
    ]),
  },
  {
    slug: "velvet-basement",
    name: "Velvet Basement",
    track: "Feel Like Makin' Love — D'Angelo",
    count: "31",
    tag: "after hours",
    bg: "radial-gradient(120% 90% at 50% 0%, #2a0c1a, #160a10)",
    glow: "#ff6fae",
    stage: "#ff6fae33",
    dj: "#ff6fae",
    blobs: mkBlobs([
      { b: "10px", l: "44px", s: "22px", c: 0 },
      { b: "18px", l: "140px", s: "16px", c: 3 },
      { b: "8px", l: "205px", s: "20px", c: 5 },
    ]),
  },
] as const;

export const FEATURES = [
  {
    icon: "🎛️",
    glow: "#ff9d3c",
    title: "Anyone can take the deck",
    body: "Step into an open booth, queue up a track, and watch a whole room react to your pick in real time. Hand off when you're done.",
  },
  {
    icon: "⚡",
    glow: "#7ed957",
    title: "React out loud",
    body: "Hit Awesome, drop a Lame, fling a heart across the floor. The room's energy meter swells and the lights respond when a track goes off.",
  },
  {
    icon: "💿",
    glow: "#5ad1c8",
    title: "Build your crate",
    body: "Heard something you love? Save it mid-set straight into your crate. Your taste, collected one room at a time.",
  },
  {
    icon: "🪩",
    glow: "#ff6fae",
    title: "Tiny venues, real presence",
    body: "Every room is its own little club with its own crowd, regulars, and weird in-jokes. Show up as a vinyl blob and find your people.",
  },
] as const;

export const STATS = [
  { n: "140+", label: "rooms spinning" },
  { n: "2.3M", label: "tracks dropped" },
  { n: "47k", label: "blobs on the floor" },
] as const;

export const QUOTES = [
  {
    text: "I came for one song and lost three hours. The crowd reacting in real time is unreasonably fun.",
    name: "mossy",
    handle: "@mossymoss",
    color: "#5ad1c8",
  },
  {
    text: "It's the only place online that feels like actually being somewhere. My basement room has regulars now.",
    name: "pluto",
    handle: "@plutocrat",
    color: "#8a7bff",
  },
  {
    text: "Took the deck on a whim, played the worst song ever, got 12 Lames, never felt more alive.",
    name: "404_disco",
    handle: "@disco404",
    color: "#7ed957",
  },
] as const;

export const MARQUEE =
  "NOW SPINNING · Midnight Pretenders — Tomoko Aran · played by vinyl_vera · ";
