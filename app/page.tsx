import { EthRings } from "./components/EthRings";
import { NarrativeShell } from "./components/NarrativeShell";

export default function Home() {
  return (
    <NarrativeShell>
      <main id="top" className="specimen-page">
        <EthRings />
      </main>
    </NarrativeShell>
  );
}
