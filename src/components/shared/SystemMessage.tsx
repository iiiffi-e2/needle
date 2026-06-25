import { cn } from "@/lib/utils";

interface SystemMessageProps {
  body: string;
  className?: string;
}

export function SystemMessage({ body, className }: SystemMessageProps) {
  return (
    <div
      className={cn(
        "text-center text-xs text-muted italic py-1 animate-fade-in",
        className
      )}
    >
      {body}
    </div>
  );
}
