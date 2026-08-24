import Link from "next/link";

export function ProductBrand({
  className = "brand",
  nameClassName = "brand-name",
  status,
  statusClassName = "brand-status",
}: {
  className?: string;
  nameClassName?: string;
  status?: string;
  statusClassName?: string;
}) {
  return (
    <Link href="/" className={className} aria-label="SecureBin home">
      <span className={nameClassName}>SecureBin</span>
      {status ? <span className={statusClassName}>{status}</span> : null}
    </Link>
  );
}
