import { EthRings } from "./components/EthRings";
import { NarrativeShell } from "./components/NarrativeShell";

export default function Home() {
  return (
    <NarrativeShell>
      <a className="skip-link" href="#rings-explorer-entry">Skip to the rings</a>
      <main id="top" className="specimen-page">
        <EthRings />
      </main>
    </NarrativeShell>
  );
}
