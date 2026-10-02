import { useState, type ReactNode } from 'react';
import { BALANCE } from '../../server/src/catalog';
import { avgMonsterLevel, formatNum, GOLD_PACK_IDS, goldPackAmount, scaledGold, type GoldPackId } from '../../server/src/growth';
import { SHOP_PRODUCTS, soulPackAmount, type SoulPackId } from '../../server/src/purchases';
import AdButton from '../render/AdButton';
import CurrencyPill from '../render/CurrencyPill';
import { VipPanel } from '../render/Vip';
import { adsLeft } from '../services/ads';
import { errorText, type Api, type HomeData } from '../services/api';
import { sfx } from '../services/audio';
import { buy, findItem, type ShopItem } from '../services/shop';
import { T } from '../strings/ko';
import { vipOf } from '../../server/src/vip';

type ProductId = (typeof SHOP_PRODUCTS)[number];
type ShopTab = 'soul' | 'gold' | 'special';

const SOUL_IDS = Object.keys(BALANCE.soulPacks) as SoulPackId[];
/** 맨 위 추천 상품: 살 수 있는 첫 번째(스타터팩 → 시즌 패스 → 성유물) */
const HERO_ORDER: ProductId[] = ['starter_pack', 'season_pass', 'soul_relic'];

/**
 * 마왕의 보물고(2026-10-02 승인 A): 전체 화면 상점. 위 재화·VIP 막대, 맨 위 추천 상품 하나,
 * 영혼석·골드·특별 탭과 큰 그림 카드. VX 가격은 Verse8이 알려 주는 값 그대로, 골드 묶음은 영혼석으로 산다.
 */
export default function Shop(props: {
  api: Api; home: HomeData; items: ShopItem[]; owned: Set<string>;
  onClose: () => void; onRefresh: () => Promise<void>; onToast: (m: string) => void;
}) {
  const { api, home, items, owned, onClose, onRefresh, onToast } = props;
  const [tab, setTab] = useState<ShopTab>('soul');
  const [goldBusy, setGoldBusy] = useState(false);
  const best = home.state.siege?.best ?? 1;
  const avgLevel = avgMonsterLevel(home.state.roster, home.state.stars ?? {});
  const supplyLeft = adsLeft(home.state, 'daily_supply', Date.now());
  const vip = vipOf(home.state);

  async function buyGold(id: GoldPackId) {
    if (goldBusy) return;
    if (home.soul < BALANCE.goldPacks[id].soul) {
      onToast(T.errors.NO_SOUL);
      setTab('soul');
      return;
    }
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

  /** VX 상품 상태: 대시보드 등록 전이면 숨김(null), 이미 가졌으면 owned */
  const vx = (id: ProductId) => {
    const item = findItem(items, id);
    if (!item && items.length > 0) return null;
    const have = owned.has(id) || !!item?.purchaseLimitReached;
    return { item, have, blocked: have || !item || !item.purchasable };
  };
  const priceButton = (id: ProductId) => {
    const v = vx(id);
    if (!v) return null;
    return (
      <button className="shop-price" disabled={v.blocked} onClick={() => buy(id)}>
        {v.have ? T.purchased : v.item ? T.buyFor(v.item.price) : T.loading}
      </button>
    );
  };
  const soulBonus = (id: SoulPackId) => {
    const p = BALANCE.soulPacks[id];
    const base = BALANCE.soulPacks.soul_pouch;
    return Math.round(((p.soul / p.vx) / (base.soul / base.vx) - 1) * 100);
  };
  const descOf = (id: ProductId) => (id === 'starter_pack' ? T.starterDesc(scaledGold(BALANCE.starterGold, best)) : T.products[id][1]);

  const hero = HERO_ORDER.find((id) => { const v = vx(id); return v && !v.have; });
  const card = (key: string, img: string, name: string, amount: ReactNode, price: ReactNode, ribbon?: string, best?: boolean) => (
    <div className={`shop-card ${best ? 'best' : ''}`} key={key}>
      {ribbon && <span className="shop-bonus">{ribbon}</span>}
      <img src={`products/${img}.png`} alt="" draggable={false} />
      <b>{name}</b>
      {amount}
      {price}
    </div>
  );

  return (
    <div className="shop">
      <header className="shop-top">
        <span className="shop-pills">
          <CurrencyPill icon="icons/soul.png" label={T.soul} value={home.soul} tone="soul" />
          <CurrencyPill icon="icons/gold.png" label={T.gold} value={home.gold} />
        </span>
        <h2>{T.shop.title}</h2>
        <button className="close" onClick={onClose} aria-label={T.close}><img src="ui/close_x.png" alt="" draggable={false} /></button>
      </header>
      <div className="shop-vip"><VipPanel spent={home.state.vip?.spent ?? 0} compact /></div>

      <div className="shop-body">
        {hero && (
          <div className="shop-hero">
            <span className="shop-ribbon">{hero === 'starter_pack' ? T.shop.once : hero === 'season_pass' ? T.shop.season : T.shop.best}</span>
            <img src={`products/${hero}.png`} alt="" draggable={false} />
            <div>
              <b>{T.products[hero][0]}</b>
              <small>{hero === 'soul_relic' ? T.soulPackDesc(soulPackAmount('soul_relic', vip), soulBonus('soul_relic')) : descOf(hero)}</small>
              {priceButton(hero)}
            </div>
          </div>
        )}

        <nav className="shop-tabs">
          {(['soul', 'gold', 'special'] as ShopTab[]).map((t) => (
            <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{T.shop.tabs[t]}</button>
          ))}
        </nav>

        {tab === 'soul' && (
          <div className="shop-grid">
            {SOUL_IDS.filter((id) => vx(id)).map((id) => {
              const bonus = soulBonus(id);
              return card(id, id, T.products[id][0],
                <span className="shop-amt soul">{formatNum(soulPackAmount(id, vip))}</span>,
                priceButton(id), bonus > 0 ? (id === 'soul_altar' ? `BEST +${bonus}%` : `+${bonus}%`) : undefined, id === 'soul_altar');
            })}
          </div>
        )}

        {tab === 'gold' && (
          <div className="shop-grid">
            {GOLD_PACK_IDS.map((id) => {
              const pack = BALANCE.goldPacks[id];
              const gold = goldPackAmount(id, best, avgLevel);
              const bonus = Math.round(((gold / pack.soul) / (goldPackAmount('gold_pouch', best, avgLevel) / BALANCE.goldPacks.gold_pouch.soul) - 1) * 100);
              return card(id, id, T.products[id][0],
                <span className="shop-amt gold">{formatNum(gold)}</span>,
                <button className="shop-price" disabled={goldBusy} onClick={() => void buyGold(id)}><img src="icons/soul.png" alt="" draggable={false} />{formatNum(pack.soul)}</button>,
                bonus > 0 ? `+${bonus}%` : undefined);
            })}
          </div>
        )}

        {tab === 'special' && (
          <div className="shop-grid">
            {card('daily_supply', 'daily_supply', T.ads.supply,
              <span className="shop-amt small">{T.ads.supplyDesc(scaledGold(BALANCE.adSupplyGold, best), BALANCE.adSupplySoul)}</span>,
              supplyLeft > 0
                ? <AdButton api={api} placement="daily_supply" label={T.ads.receive} premium={!!home.state.perks?.premium} className="shop-price" onDone={onRefresh} onToast={onToast} />
                : <button className="shop-price" disabled>{T.ads.tomorrow}</button>)}
            {(['season_pass', 'speed_x3', 'premium', 'starter_pack'] as ProductId[]).filter((id) => vx(id) && id !== hero).map((id) =>
              card(id, id, T.products[id][0], <span className="shop-amt small">{descOf(id)}</span>, priceButton(id)))}
          </div>
        )}
      </div>
    </div>
  );
}
