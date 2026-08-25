"use client";

import { useEffect, useState } from "react";

export interface ShareActionsProps {
  readonly shareUrl: string;
}

function toMailto(url: string): string {
  const subject = encodeURIComponent("A private share for you");
  const body = encodeURIComponent(
    "Open this link to view the private share. The link includes its decryption key, so keep it intact:\n\n" + url
  );
  return `mailto:?subject=${subject}&body=${body}`;
}

/**
 * Share actions (T1 §2.8): copy, QR, native share, email. The QR encodes the
 * full fragment URL and is generated locally; no third-party requests.
 */
export function ShareActions({ shareUrl }: ShareActionsProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [nativeSupported, setNativeSupported] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");

  useEffect(() => {
    setNativeSupported(typeof navigator !== "undefined" && typeof navigator.share === "function");
    if (!showQr || qrDataUrl || qrFailed) return;
    let cancelled = false;
    void (async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const dataUrl = await QRCode.toDataURL(shareUrl, {
          errorCorrectionLevel: "L",
          margin: 2,
          width: 220,
          color: { dark: "#17242D", light: "#F4F0E8" },
        });
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showQr, shareUrl, qrDataUrl, qrFailed]);

  async function nativeShare() {
    try {
      await navigator.share({ title: "A private share", url: shareUrl });
      setShareFeedback("Share sheet opened.");
    } catch {
      setShareFeedback("Share sheet closed. The complete link was not changed.");
    }
  }

  return (
    <div className="share-actions-extra">
      {showQr && (
        <div className="qr-panel">
          {qrDataUrl ? (
            <>
              {/* Locally generated data URL - no remote fetch. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code containing the full share link" width={220} height={220} />
              <a className="action-button tertiary-button" href={qrDataUrl} download="securebin-qr.png">
                Download QR image
              </a>
            </>
          ) : qrFailed ? (
            <p className="policy-hint">QR generation failed locally; use Copy link instead.</p>
          ) : (
            <p className="policy-hint" role="status">
              Generating QR…
            </p>
          )}
        </div>
      )}
      <button type="button" className="action-button tertiary-button" onClick={() => setShowQr((p) => !p)}>
        {showQr ? "Hide QR code" : "Show QR code"}
      </button>
      {nativeSupported && (
        <button type="button" className="action-button tertiary-button" onClick={nativeShare}>
          Share…
        </button>
      )}
      <a className="action-button tertiary-button" href={toMailto(shareUrl)}>
        Send by email
      </a>
      <p className="share-transport-note" role="note">
        These options pass the complete link, including its fragment-held decryption key, to the channel you choose. Use a separate channel for any unlock code.
      </p>
      {shareFeedback && <p className="share-transport-feedback" role="status" aria-live="polite">{shareFeedback}</p>}
    </div>
  );
}
