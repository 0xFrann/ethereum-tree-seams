import marketData from "@/data/eth-market.json";
import { EthRings, type MarketData } from "./components/EthRings";

export default function Home() {
  const data = marketData as MarketData;

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Ethereum Annual Rings home">
          <span className="wordmark-gem" aria-hidden="true">◆</span>
          Annual Rings
        </a>
        <a className="header-link" href="#rings-instructions">How to read it</a>
      </header>

      <section id="top" className="hero" aria-labelledby="page-title">
        <div className="hero-copy">
          <p className="eyebrow">Bitstamp ETH / USD · 2019—2025</p>
          <h1 id="page-title">A market<br />remembered<br />as growth.</h1>
          <p className="dek">
            Seven years of Ethereum price and volume recast as the rings of a tree—each season adding pressure, texture, and scars.
          </p>
          <div className="encoding-key" aria-label="Visual encoding legend">
            <span><i className="key-line" aria-hidden="true" /> Shape <b>price</b></span>
            <span><i className="key-weight" aria-hidden="true" /> Weight <b>volume</b></span>
            <span><i className="key-knot" aria-hidden="true" /> Knots <b>shocks</b></span>
          </div>
        </div>

        <EthRings data={data} />
      </section>
    </main>
  );
}
