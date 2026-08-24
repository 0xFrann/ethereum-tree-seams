'use client';

import { useEffect, useRef } from 'react';
import { useSessionIntroduction } from '../hooks/use-session-introduction';
import styles from './Introduction.module.css';

export function Introduction() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { open, dismiss, show } = useSessionIntroduction();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button className={styles.reopen} type="button" onClick={show}>
        About this view
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="introduction-title"
        onCancel={(event) => {
          event.preventDefault();
          dismiss();
        }}
      >
        <p>Ethereum annual rings</p>
        <h2 id="introduction-title">A market remembered as growth.</h2>
        <p>
          Each ring is one observed calendar year. Its contour follows monthly closing
          prices; its weight follows reported trading volume. Protocol milestones and
          ecosystem incidents leave distinct marks at their place in the annual cycle.
        </p>
        <button type="button" onClick={dismiss} autoFocus>
          Enter the rings
        </button>
      </dialog>
    </>
  );
}
