import { BALANCE } from '../../server/src/catalog';
import { Fragment, useState } from 'react';
import { avgMonsterLevel, GOLD_PACK_IDS, goldPackAmount, scaledGold } from '../../server/src/growth';
import { SHOP_PRODUCTS, soulPackAmount, type SoulPackId } from '../../server/src/purchases';
import AdButton from '../render/AdButton';
import { Portrait } from '../render/Sprite';
import { adsLeft } from '../services/ads';
import type { Api, HomeData } from '../services/api';
import { buy, findItem, type ShopItem } from '../services/shop';
import { errorText } from '../services/api';
import { sfx } from '../services/audio';
import { T } from '../strings/ko';
import { VipPanel } from '../render/Vip';
import { vipOf } from '../../server/src/vip';

/** owned: 이미 효과가 켜져 있어 다시 사도 소용없는 상품 (예: 이번 시즌 패스) */
export default function Shop(props: {
  api: Api; home: HomeData; items: ShopItem[]; owned: Set<string>;
  onRefresh: () => Promise<void>; onToast: (m: string) => void;
}) {
  const { api, home, onRefresh, onToast } = props;
  const supplyLeft = adsLeft(home.state, 'daily_supply', Date.now());
  const best = home.state.siege?.best ?? 1;
  const avgLevel = avgMonsterLevel(home.state.roster, home.state.stars ?? {});
  const [goldBusy, setGoldBusy] = useState(false);
  async function buyGold(id: string) {
    if (goldBusy) return;
    setGoldBusy(true);
    try {
      await api.buyGold(id);
      sfx('sfx_purchase');
      await onRefresh();
    } catch (e) {
      onToast(errorText(e));
    } finally {
      setGoldBusy(false);
    }
  }

  function productRow(id: (typeof SHOP_PRODUCTS)[number]) {
    const item = findItem(props.items, id);
    const [name, fixedDesc] = T.products[id];
    // 영혼석 묶음: VIP 보너스까지 더한 실제 지급량, "N% 더"는 주머니 대비 VX당 비율(VIP와 상관없이)
    const soulPack = id in BALANCE.soulPacks ? BALANCE.soulPacks[id as SoulPackId] : null;
    const soulBonus = soulPack ? Math.round(((soulPack.soul / soulPack.vx) / (BALANCE.soulPacks.soul_pouch.soul / BALANCE.soulPacks.soul_pouch.vx) - 1) * 100) : 0;
    const desc = id === 'starter_pack' ? T.starterDesc(scaledGold(BALANCE.starterGold, best))
      : soulPack ? T.soulPackDesc(soulPackAmount(id as SoulPackId, vipOf(home.state)), soulBonus) : fixedDesc;
    const owned = props.owned.has(id) || !!item?.purchaseLimitReached;
    const blocked = owned || !item || !item.purchasable;
    // 대시보드에 아직 없는 상품(등록 전)은 목록이 온 뒤에는 숨긴다
    if (!item && props.items.length > 0) return null;
    return (
      <div className="line" key={id}>
        <span className="item"><Portrait id={`prod_${id}`} label={name} /><span><b>{name}</b><br /><small>{desc}</small></span></span>
        <button className="btn small" disabled={blocked} onClick={() => buy(id)}>
          {owned ? T.purchased : item ? T.buyFor(item.price) : T.loading}
        </button>
      </div>
    );
  }

  const goldRows = (
    <>
      {/* 골드 묶음: 영혼석으로 산다(2026-10-01). 이 계정이 받을 골드(서버와 같은 식)와 주머니 대비 영혼석당 더 주는 비율 */}
      {GOLD_PACK_IDS.map((id) => {
        const pack = BALANCE.goldPacks[id];
        const gold = goldPackAmount(id, best, avgLevel);
        const bonus = Math.round(((gold / pack.soul) / (goldPackAmount('gold_pouch', best, avgLevel) / BALANCE.goldPacks.gold_pouch.soul) - 1) * 100);
        return (
          <div className="line" key={id}>
            <span className="item"><Portrait id={`prod_${id}`} label={T.products[id][0]} /><span><b>{T.products[id][0]}</b><br /><small>{T.goldPackDesc(gold, bonus)}</small></span></span>
            <button className="btn small" disabled={goldBusy || home.soul < pack.soul} onClick={() => buyGold(id)}>{T.goldForSoul(pack.soul)}</button>
          </div>
        );
      })}
    </>
  );

  return (
    <>
      {/* VIP: 누적 결제 등급, 다음 등급까지 남은 VX, 다음 등급 혜택 */}
      <VipPanel spent={home.state.vip?.spent ?? 0} />
      <div className="line">
        <span className="item"><Portrait id="prod_daily_supply" label={T.ads.supply} /><span><b>{T.ads.supply}</b><br /><small>{T.ads.supplyDesc(scaledGold(BALANCE.adSupplyGold, best), BALANCE.adSupplySoul)}</small></span></span>
        {supplyLeft > 0
          ? <AdButton api={api} placement="daily_supply" label={T.ads.receive} premium={!!home.state.perks?.premium} onDone={onRefresh} onToast={onToast} />
          : <button className="btn small" disabled>{T.ads.tomorrow}</button>}
      </div>
      {SHOP_PRODUCTS.map((id) => (
        <Fragment key={id}>
          {productRow(id)}
          {/* 영혼석 묶음 바로 뒤: 영혼석으로 사는 골드 묶음 */}
          {id === 'soul_relic' && goldRows}
        </Fragment>
      ))}
    </>
  );
}
