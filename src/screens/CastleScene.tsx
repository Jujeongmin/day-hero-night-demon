import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { BALANCE, LORD, MONSTERS } from '../../server/src/catalog';
import { floorsUnlocked } from '../../server/src/economy';
import Sprite from '../render/Sprite';
import { lordSpriteId } from '../render/skins';
import { errorText, type Api, type HomeData } from '../services/api';
import { T } from '../strings/ko';

/** tower.png(224×400) 안에서 몬스터가 딛는 선(%). 누르는 영역은 그 선 위 몬스터 키만큼. */
const THRONE = { stand: 10.5 };
/** inset: 층 벽 좌우 여백(%). 누르는 영역·잠금 표시를 탑 벽 폭에 맞춘다 */
const TIERS = [[76, 23.5], [53.5, 28], [31, 31.5]].map(([stand, inset]) => ({ stand, inset, top: stand - 13, bottom: stand + 4 })); // 1층, 2층, 3층
const SLOT_X = [36, 50, 64];
const TOWER_H = 400;

/** index번째 층이 열리는 성 레벨 */
function levelFor(index: number): number {
  for (let l = 1; l <= BALANCE.maxCastleLevel; l++) if (floorsUnlocked(l) > index) return l;
  return BALANCE.maxCastleLevel;
}

function useHeight(ref: React.RefObject<HTMLElement | null>): number {
  const [h, setH] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, [ref]);
  return h;
}

/** 항상 보이는 메인 화면: 마왕성 탑. 층을 누르면 그 층 편성 창이 열린다. */
export default function CastleScene(props: {
  api: Api;
  home: HomeData;
  selected: number | null;
  /** 아래 창이 열리면 출정 버튼을 숨겨 탑을 가리지 않는다 */
  panelOpen: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onRefresh: () => Promise<void>;
  onRaid: () => void;
  onMatch: () => void;
  onFloor: (index: number) => void;
  onLocked: () => void;
  onError: (msg: string) => void;
}) {
  const { api, home, selected, panelOpen, muted, onToggleMute, onRefresh, onRaid, onMatch, onFloor, onLocked, onError } = props;
  const s = home.state;
  const [busy, setBusy] = useState(false);
  const towerRef = useRef<HTMLDivElement>(null);
  const k = useHeight(towerRef) / TOWER_H;
  const away = s.awayUntil > Date.now();
  const open = floorsUnlocked(s.castle.level);

  async function act(fn: () => Promise<unknown>, after?: () => void) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      await onRefresh();
      after?.();
    } catch (e) {
      onError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const at = (x: number, y: number): CSSProperties => ({ left: `${x}%`, top: `${y}%` });
  const unitScale = k * 0.7;

  return (
    <div className={`scene ${panelOpen ? 'panel-open' : ''}`}>
      <img className="backdrop" src="sprites/bg_night.png" alt="" draggable={false} />
      <header className="hud">
        <span className="pill"><b>{home.gold}</b> {T.gold}</span>
        <button className="pill" onClick={onToggleMute}>{muted ? T.soundOff : T.soundOn}</button>
        <span className="pill"><b>{home.soul}</b> {T.soul}</span>
      </header>

      <div className="tower" ref={towerRef}>
        <img src="sprites/tower.png" alt="" draggable={false} />

        <div className="unit-at" style={at(50, THRONE.stand)}>
          {away
            ? <span className="chip">{T.throneEmptyBadge}</span>
            : <Sprite id={lordSpriteId(s.season.pass ? 'skull' : undefined)} label={LORD.name} scale={unitScale} />}
        </div>

        {TIERS.map((tier, i) => {
          const floor = s.castle.floors[i];
          const locked = i >= open || !floor;
          return (
            <div key={i}>
              {!locked && floor.monsters.map((m, j) => m && (
                <div className="unit-at" key={j} style={at(SLOT_X[j], tier.stand)}>
                  <Sprite id={m} label={MONSTERS[m].name} flip scale={unitScale} />
                </div>
              ))}
              <button
                className={`tier ${locked ? 'locked' : ''} ${selected === i ? 'on' : ''}`}
                data-tut={`floor-${i}`}
                style={{ top: `${tier.top}%`, height: `${tier.bottom - tier.top}%`, left: `${tier.inset}%`, right: `${tier.inset}%` }}
                disabled={!!s.run}
                onClick={() => (locked ? onLocked() : onFloor(i))}
                aria-label={T.floor(i + 1)}
              >
                {locked && <span className="chip">{T.lockedFloor(levelFor(i))}</span>}
              </button>
            </div>
          );
        })}
      </div>

      {home.idlePreview > 0 && (
        <button className="btn gold float-idle" disabled={busy} onClick={() => act(() => api.claimIdle())}>
          +{home.idlePreview}
        </button>
      )}

      {!panelOpen && <div className="scene-foot">
        {s.run ? (
          <button className="btn big" onClick={onRaid}>{T.resumeBtn}</button>
        ) : (
          <button
            className="btn big"
            data-tut="sortie"
            disabled={busy}
            onClick={() => (s.introDone ? onMatch() : act(() => api.startIntroRaid(), onRaid))}
          >
            {T.sortie}
          </button>
        )}
      </div>}
    </div>
  );
}
