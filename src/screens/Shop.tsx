import { SHOP_PRODUCTS } from '../../server/src/purchases';
import { Portrait } from '../render/Sprite';
import { buy, findItem, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';

/** owned: 이미 효과가 켜져 있어 다시 사도 소용없는 상품 (예: 이번 시즌 패스) */
export default function Shop(props: { items: ShopItem[]; owned: Set<string> }) {
  return (
    <>
      {SHOP_PRODUCTS.map((id) => {
        const item = findItem(props.items, id);
        const [name, desc] = T.products[id];
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
