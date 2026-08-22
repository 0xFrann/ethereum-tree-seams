import { EthRings } from "./components/EthRings";
import { NarrativeShell } from "./components/NarrativeShell";

export default function Home() {
  return (
    <NarrativeShell>
      <a className="skip-link" href="#rings-explorer-entry">Skip to the rings</a>
      <div className="archive-chrome" aria-hidden="true">
        <span className="crop-mark crop-mark-nw" />
        <span className="crop-mark crop-mark-ne" />
        <span className="crop-mark crop-mark-sw" />
        <span className="crop-mark crop-mark-se" />
        <div className="eth-sigil">
          <svg viewBox="0 0 48 78" focusable="false">
            <path d="M24 1 3 39l21 12 21-12L24 1Z" />
            <path d="m3 43 21 34 21-34-21 12L3 43Z" />
            <path d="M24 1v50L3 39l21-11 21 11-21 12" />
          </svg>
        </div>
        <p className="plate-note">EVM / L1 · UNVALIDATED VISUAL HYPOTHESIS · PLATE 01</p>
      </div>
      <main id="top" className="specimen-page">
        <EthRings />
      </main>
    </NarrativeShell>
  );
}
