import { cn } from "@/lib/utils";

interface NeedlebotMessageProps {
  body: string;
  className?: string;
}

export function NeedlebotMessage({ body, className }: NeedlebotMessageProps) {
  const text = body.replace(/^🤖 Needlebot:\s*/, "");

  return (
    <div
      className={cn(
        "flex gap-2 items-start py-2 px-3 rounded-lg bg-accent/5 border border-accent/10 animate-fade-in",
        className
      )}
    >
      <span className="text-sm shrink-0">🤖</span>
      <p className="text-sm text-accent/90 leading-relaxed">{text}</p>
    </div>
  );
}
