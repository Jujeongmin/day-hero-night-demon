import { BALANCE } from '../../server/src/catalog';
import { vipLevel, vipPerks } from '../../server/src/vip';
import { T } from '../strings/ko';

/** 배지 그림 등급: 1~3 청동, 4~6 은, 7~9 금, 10 루비 왕관 (public/ui/vip_*.png, PixelLab) */
function tierOf(level: number): 'bronze' | 'silver' | 'gold' | 'ruby' {
  return level >= 10 ? 'ruby' : level >= 7 ? 'gold' : level >= 4 ? 'silver' : 'bronze';
}

/** 이름 옆 VIP 배지. VIP 0이면 아무것도 그리지 않는다 */
export function VipBadge(props: { level?: number }) {
  const lv = props.level ?? 0;
  if (lv <= 0) return null;
  const tier = tierOf(lv);
  return (
    <span className={`vip-badge ${tier}`} aria-label={T.vip.level(lv)}>
      <img src={`ui/vip_${tier}.png`} alt="" draggable={false} />
      {lv}
    </span>
  );
}

/** 다음 등급에서 달라지는 혜택만 한 줄씩 */
export function nextVipPerks(level: number): string[] {
  if (level >= BALANCE.vip.thresholds.length) return [];
  const a = vipPerks(level);
  const b = vipPerks(level + 1);
  const out: string[] = [];
  if (b.idleBonus !== a.idleBonus) out.push(T.vip.idle(Math.round(b.idleBonus * 100)));
  if (b.awayMult !== a.awayMult) out.push(T.vip.away(b.awayMult));
  if (b.capHours !== a.capHours) out.push(T.vip.cap(b.capHours));
  if (b.packBonus !== a.packBonus) out.push(T.vip.pack(Math.round(b.packBonus * 100)));
  if (b.idleDoubleExtra !== a.idleDoubleExtra) out.push(T.vip.idleAd(BALANCE.adLimits.idle_double + b.idleDoubleExtra));
  if (b.revengeExtra !== a.revengeExtra) out.push(T.vip.revenge(BALANCE.freeRevengesPerDay + b.revengeExtra));
  if (b.nicknameExtra !== a.nicknameExtra) out.push(T.vip.nickname);
  for (const [skin, at] of Object.entries(BALANCE.vip.skins)) if (at === level + 1) out.push(T.vip.skin(T.vip.skins[skin] ?? skin));
  if (BALANCE.vip.rubyAura === level + 1) out.push(T.vip.skin(T.vip.aura));
  return out;
}

/** 내 VIP: 배지, 다음 등급까지 남은 VX 막대, 다음 등급 혜택. compact면 막대까지만 */
export function VipPanel(props: { spent: number; compact?: boolean }) {
  const lv = vipLevel(props.spent);
  const th = BALANCE.vip.thresholds;
  const max = lv >= th.length;
  const from = lv === 0 ? 0 : th[lv - 1];
  const to = max ? from : th[lv];
  const ratio = max ? 1 : Math.max(0, Math.min(1, (props.spent - from) / (to - from)));
  const perks = props.compact ? [] : nextVipPerks(lv);
  return (
    <div className="vip-panel">
      <div className="vip-head">
        {lv > 0 ? <VipBadge level={lv} /> : <span className="muted">{T.vip.none}</span>}
        <span className="vip-next">{max ? T.vip.max : T.vip.toNext(to - props.spent, lv + 1)}</span>
      </div>
      <div className="vip-bar"><span style={{ width: `${ratio * 100}%` }} /></div>
      {perks.length > 0 && <small className="vip-perks">{T.vip.nextTitle}: {perks.join(' · ')}</small>}
    </div>
  );
}
