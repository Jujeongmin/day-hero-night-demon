import { VXShop } from '@verse8/platform/vanilla';

export type ShopItem = ReturnType<typeof VXShop.getItems>[number];

let initialized = false;

/** 상점 상태를 구독한다. 결제 창이 닫히면 목록을 새로 받고 onClosed를 부른다(지급은 서버 웹훅이 한다). */
export function startShop(onItems: (items: ShopItem[]) => void, onClosed: () => void): () => void {
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
  VXShop.buyItem(productId);
}

export function findItem(items: ShopItem[], productId: string): ShopItem | undefined {
  return items.find((i) => i.productId === productId);
}
