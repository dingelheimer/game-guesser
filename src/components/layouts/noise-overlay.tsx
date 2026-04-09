export function NoiseOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 bg-[url('/noise.svg')] bg-repeat opacity-[0.03]"
    />
  );
}
