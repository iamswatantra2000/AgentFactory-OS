'use client';
import { useId, useRef } from 'react';
import { ArrowRightIcon, XIcon } from '@phosphor-icons/react';
import { Button } from '@/components/design-system';
import styles from './landing.module.css';

/** Temporary destination until the account/entitlement slice is implemented. */
export function AccessAction({
  signIn = false,
  arrow = false,
}: {
  signIn?: boolean;
  arrow?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={signIn ? styles.textAction : styles.primaryAction}
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
      >
        {signIn ? 'Sign in' : 'Get started'}
        {arrow && <ArrowRightIcon size={20} aria-hidden="true" />}
      </button>
      <dialog
        ref={dialog}
        className={styles.dialog}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        onClose={() => trigger.current?.focus()}
      >
        <button
          type="button"
          className={styles.closeDialog}
          aria-label="Close"
          onClick={() => dialog.current?.close()}
        >
          <XIcon size={20} />
        </button>
        <p className={styles.eyebrow}>Product preview</p>
        <h2 id={titleId}>{signIn ? 'Sign-in is coming next.' : 'Your company starts here.'}</h2>
        <p id={descriptionId}>
          Account creation and sign-in are not available in this preview. The planned journey is an
          account, a plan, then your company workspace.
        </p>
        <p className={styles.dialogNote}>
          Workspace access will require an active plan. No payment is collected here.
        </p>
        <Button onClick={() => dialog.current?.close()}>Continue exploring</Button>
      </dialog>
    </>
  );
}
