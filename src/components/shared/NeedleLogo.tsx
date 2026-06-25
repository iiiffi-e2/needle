export function NeedleLogo({ size = 34 }: { size?: number }) {
  return (
    <div
      className="relative shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 50% 50%, var(--ndl-bg1) 0 22%, var(--ndl-glow) 23% 30%, var(--ndl-bg1) 31% 46%, var(--ndl-glow2) 47% 52%, var(--ndl-bg1) 53%)",
        boxShadow: "0 0 16px color-mix(in srgb, var(--ndl-glow) 60%, transparent)",
      }}
    >
      <div
        className="absolute rounded-full bg-foreground"
        style={{
          width: 5,
          height: 5,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
    </div>
  );
}
