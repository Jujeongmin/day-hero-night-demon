import { BALANCE } from '../../server/src/catalog';
import { avgMonsterLevel, goldPackAmount, scaledGold, type GoldPackId } from '../../server/src/growth';
import { SHOP_PRODUCTS } from '../../server/src/purchases';
import AdButton from '../render/AdButton';
import { Portrait } from '../render/Sprite';
import { adsLeft } from '../services/ads';
import type { Api, HomeData } from '../services/api';
import { buy, findItem, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';
import { VipPanel } from '../render/Vip';
import { vipOf, vipPerks } from '../../server/src/vip';

/** owned: 이미 효과가 켜져 있어 다시 사도 소용없는 상품 (예: 이번 시즌 패스) */
export default function Shop(props: {
  api: Api; home: HomeData; items: ShopItem[]; owned: Set<string>;
  onRefresh: () => Promise<void>; onToast: (m: string) => void;
}) {
  const { api, home, onRefresh, onToast } = props;
  const supplyLeft = adsLeft(home.state, 'daily_supply', Date.now());
  const best = home.state.siege?.best ?? 1;
  const avgLevel = avgMonsterLevel(home.state.roster);
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
      {SHOP_PRODUCTS.map((id) => {
        const item = findItem(props.items, id);
        const [name, fixedDesc] = T.products[id];
        // 골드 묶음: 이 계정이 실제로 받을 골드(서버 지급과 같은 식)와 100 VX 대비 VX당 더 주는 비율
        const pack = id in BALANCE.goldPacks ? BALANCE.goldPacks[id as GoldPackId] : null;
        const packBase = pack ? goldPackAmount(id as GoldPackId, best, avgLevel) : 0;
        // VIP 골드 묶음 추가 지급까지 더한 실제 금액. "N% 더"는 VIP와 상관없이 주머니 대비 VX당 비율
        const packGold = Math.floor(packBase * (1 + vipPerks(vipOf(home.state)).packBonus));
        const bonus = pack ? Math.round(((packBase / pack.vx) / (goldPackAmount('gold_pouch', best, avgLevel) / BALANCE.goldPacks.gold_pouch.vx) - 1) * 100) : 0;
        const desc = id === 'starter_pack' ? T.starterDesc(scaledGold(BALANCE.starterGold, best)) : pack ? T.goldPackDesc(packGold, bonus) : fixedDesc;
        const owned = props.owned.has(id) || !!item?.purchaseLimitReached;
        const blocked = owned || !item || !item.purchasable;
        return (
          <div className="line" key={id}>
            <span className="item"><Portrait id={`prod_${id}`} label={name} /><span><b>{name}</b><br /><small>{desc}</small></span></span>
            <button className="btn small" disabled={blocked} onClick={() => buy(id)}>
              {owned ? T.purchased : item ? T.buyFor(item.price) : T.loading}
            </button>
          </div>
        );
      })}
    </>
  );
}
