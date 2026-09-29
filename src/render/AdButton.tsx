import { useState } from 'react';
import type { Placement } from '../../server/src/ads';
import { earnAd } from '../services/ads';
import { errorText, type Api } from '../services/api';
import { T } from '../strings/ko';

/** 광고 보상 버튼. 프리미엄이면 광고 없이 바로 받는다. 누르는 동안 잠근다. */
export default function AdButton(props: {
  api: Api;
  placement: Placement;
  label: string;
  premium: boolean;
  disabled?: boolean;
  className?: string;
  onDone: () => Promise<void> | void;
  onToast: (m: string) => void;
}) {
  const { api, placement, label, premium, disabled, className = 'btn small', onDone, onToast } = props;
  const [busy, setBusy] = useState(false);

  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await earnAd(api, placement, premium);
      if (r === 'ok') {
        await onDone();
        onToast(T.ads.got);
      } else {
        onToast(r === 'dismissed' ? T.ads.dismissed : T.ads.failed);
      }
    } catch (e) {
      onToast(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={className} disabled={busy || disabled} onClick={go}>
      {premium ? T.ads.instant(label) : T.ads.watch(label)}
    </button>
  );
}
