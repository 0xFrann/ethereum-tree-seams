import { EthRings } from "./components/EthRings";
import { PaperPattern } from "./components/PaperPattern";

export default function Home() {
  return (
    <>
      <PaperPattern />
      <main id="top" className="specimen-page">
        <EthRings />
      </main>
    </>
  );
}
