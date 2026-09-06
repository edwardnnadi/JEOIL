/* oxlint-disable next/no-img-element -- Native images avoid next/image React runtime conflicts in this vinext app. */
import Link from 'next/link';

export function Brand() {
  return (
    <Link href="/" className="je-brand" aria-label="JE Oils home">
      <img src="/brand/je-oils-logo.png" alt="" width="48" height="48" />
      <span>
        JE OILS<small>INSPIRED BY CHANGE</small>
      </span>
    </Link>
  );
}

