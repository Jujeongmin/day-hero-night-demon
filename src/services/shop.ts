import { VXShop } from '@verse8/platform/vanilla';
import { SHOP_PRODUCTS } from '../../server/src/purchases';
import { isLocal, localBuy } from './connection';

export type ShopItem = ReturnType<typeof VXShop.getItems>[number];

let initialized = false;

/** 상점 상태를 구독한다. 결제 창이 닫히면 목록을 새로 받고 onClosed를 부른다(지급은 서버 웹훅이 한다). */
let closed: (() => void) | null = null;

export function startShop(onItems: (items: ShopItem[]) => void, onClosed: () => void): () => void {
  if (isLocal()) {
    // 로컬 서버 모드: 대시보드 대신 가짜 목록(가격 0), 사면 바로 웹훅
    onItems(SHOP_PRODUCTS.map((productId) => ({ productId, price: 0, purchasable: true, purchaseLimitReached: false })) as unknown as ShopItem[]);
    closed = onClosed;
    return () => { closed = null; };
  }
  const unsubscribe = VXShop.subscribe((state) => onItems(state.items));
  const offClose = VXShop.onClose(() => {
    void VXShop.refresh();
    onClosed();
  });
  if (!initialized) {
    VXShop.init();
    initialized = true;
  }
  return () => {
    unsubscribe();
    offClose();
  };
}

export function buy(productId: string): void {
  if (isLocal()) {
    void localBuy(productId).then(() => closed?.());
    return;
  }
  VXShop.buyItem(productId);
}

export function findItem(items: ShopItem[], productId: string): ShopItem | undefined {
  return items.find((i) => i.productId === productId);
}
