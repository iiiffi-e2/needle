"use client";

interface StepOffConfirmSheetProps {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StepOffConfirmSheet({
  open,
  loading,
  onConfirm,
  onCancel,
}: StepOffConfirmSheetProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="needle-mobile-backdrop lg:hidden"
        aria-label="Cancel"
        onClick={onCancel}
      />
      <div
        className="needle-step-off-dialog lg:hidden"
        role="dialog"
        aria-labelledby="step-off-title"
        aria-modal="true"
      >
        <div className="glass-panel rounded-2xl p-5 w-full max-w-[300px] shadow-[0_18px_50px_rgba(0,0,0,0.75)]">
          <h2
            id="step-off-title"
            className="font-display font-extrabold text-[17px]"
          >
            Step off the deck?
          </h2>
          <p className="text-[13px] mt-2 leading-relaxed" style={{ color: "var(--sub)" }}>
            You&apos;ll leave the booth, but you can jump back on anytime from an
            open slot.
          </p>
          <div className="flex gap-2.5 mt-5">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 py-2.5 rounded-[10px] border font-bold text-[13px] cursor-pointer disabled:opacity-50"
              style={{
                borderColor: "var(--line)",
                background: "#ffffff10",
                color: "var(--txt)",
              }}
            >
              Stay on deck
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 py-2.5 rounded-[10px] border-none font-display font-extrabold text-[13px] cursor-pointer disabled:opacity-50"
              style={{
                color: "#1a0d06",
                background: "linear-gradient(120deg, var(--glow2), var(--glow))",
              }}
            >
              {loading ? "…" : "Step off"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
