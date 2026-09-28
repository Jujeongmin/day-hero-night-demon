import { PRODUCTS } from '../../server/src/purchases';
import { buy, findItem, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';

export default function Shop(props: { items: ShopItem[] }) {
  return (
    <div className="screen shop">
      <h3>{T.shopTitle}</h3>
      {PRODUCTS.map((id) => {
        const item = findItem(props.items, id);
        const [name, desc] = T.products[id];
        const blocked = !item || !item.purchasable || item.purchaseLimitReached;
        return (
          <div className="card" key={id}>
            <b>{name}</b>
            <span>{desc}</span>
            <button className="btn" disabled={blocked} onClick={() => buy(id)}>
              {item?.purchaseLimitReached ? T.purchased : item ? T.buyFor(item.price) : T.loading}
            </button>
          </div>
        );
      })}
    </div>
  );
}
