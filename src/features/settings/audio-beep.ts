// Bip court joué sur la sortie choisie (test de sortie et notifications sonores).
// La sortie passe par un élément <audio> : setSinkId y est typé et disponible dans le navigateur.

export function playBeep(volumePct: number, sinkId: string): void {
  try {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = (0.2 * volumePct) / 100;
    osc.frequency.value = 880;
    osc.connect(gain).connect(dest);
    const el = new Audio();
    el.srcObject = dest.stream;
    if (sinkId) el.setSinkId(sinkId).catch((e: unknown) => console.error("choix de la sortie impossible", e));
    el.play().catch((e: unknown) => console.error("lecture du bip impossible", e));
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = (): void => {
      el.pause();
      el.srcObject = null;
      void ctx.close();
    };
  } catch (e) {
    console.error("bip impossible", e);
  }
}
