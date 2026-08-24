import { AnnualRingsExplorer } from '@/features/annual-rings/components/AnnualRingsExplorer';
import { Introduction } from '@/features/narrative/components/Introduction';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.page} id="top">
      <header className={styles.header}>
        <a className={styles.wordmark} href="#top">
          <span>◆</span> Annual Rings
        </a>
        <Introduction />
      </header>
      <section className={styles.hero} aria-labelledby="page-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Bitstamp ETH / USD · observed daily</p>
          <h1 className={styles.title} id="page-title">
            A market
            <br />
            remembered
            <br />
            as growth.
          </h1>
          <p className={styles.dek}>
            Ethereum’s price and volume history becomes a living cross-section—one ring
            for every observed year.
          </p>
          <p className={styles.key}>
            Contour: monthly price · weight: volume · marks: events
          </p>
        </div>
        <AnnualRingsExplorer />
      </section>
      <footer className={styles.footer}>
        Daily market observations are cached privately before they reach this page. The
        graph never contacts a market-data provider from a visitor request; its refresh
        timestamp and source cutoff remain visible through the market-data API response.
      </footer>
    </main>
  );
}
