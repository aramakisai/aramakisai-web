export function SignageTrialOverlay({
  trialShiftMs,
}: {
  readonly trialShiftMs: number | null;
}) {
  if (trialShiftMs === null) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      <span className="font-display text-[280px] leading-none font-bold text-text opacity-15">
        試験中
      </span>
    </div>
  );
}
