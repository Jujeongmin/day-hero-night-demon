import { BALANCE } from '../../server/src/catalog';
import { scaledGold } from '../../server/src/growth';
import { SHOP_PRODUCTS } from '../../server/src/purchases';
import AdButton from '../render/AdButton';
import { Portrait } from '../render/Sprite';
import { adsLeft } from '../services/ads';
import type { Api, HomeData } from '../services/api';
import { buy, findItem, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';

/** owned: 이미 효과가 켜져 있어 다시 사도 소용없는 상품 (예: 이번 시즌 패스) */
export default function Shop(props: {
  api: Api; home: HomeData; items: ShopItem[]; owned: Set<string>;
  onRefresh: () => Promise<void>; onToast: (m: string) => void;
}) {
  const { api, home, onRefresh, onToast } = props;
  const supplyLeft = adsLeft(home.state, 'daily_supply', Date.now());
  const best = home.state.siege?.best ?? 1;
  return (
    <>
      <div className="line">
        <span className="item"><Portrait id="prod_daily_supply" label={T.ads.supply} /><span><b>{T.ads.supply}</b><br /><small>{T.ads.supplyDesc(scaledGold(BALANCE.adSupplyGold, best), BALANCE.adSupplySoul)}</small></span></span>
        {supplyLeft > 0
          ? <AdButton api={api} placement="daily_supply" label={T.ads.receive} premium={!!home.state.perks?.premium} onDone={onRefresh} onToast={onToast} />
          : <button className="btn small" disabled>{T.ads.tomorrow}</button>}
      </div>
      {SHOP_PRODUCTS.map((id) => {
        const item = findItem(props.items, id);
        const [name, fixedDesc] = T.products[id];
        const desc = id === 'starter_pack' ? T.starterDesc(scaledGold(BALANCE.starterGold, best)) : fixedDesc;
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
