import { useEffect, useRef, useState } from 'react';
import Sprite from './Sprite';
import { SIEGE, stepSiege, type SiegeState } from './siegeSim';

const TICK_MS = 66;

/** 홈 화면: 성으로 몰려오는 침입 용사를 1층 몬스터가 쓰러뜨리는 연출. 골드는 서버가 방치 수입과 함께 계산한다. */
export default function Siege(props: {
  /** 땅 높이 = 화면 아래에서 탑 밑동까지(px) */
  ground: number;
  /** 1층 몬스터 공격력 합 (강할수록 빨리 쓰러뜨린다) */
  atk: number;
  paused: boolean;
  onFighting: (fighting: boolean) => void;
}) {
  const { ground, atk, paused, onFighting } = props;
  const [s, setS] = useState<SiegeState>({ t: 0, nextId: 1, spawnIn: 0.5, invaders: [], coins: [], castleHp: SIEGE.castleMax });
  const fightingRef = useRef(false);
  const atkRef = useRef(atk);
  atkRef.current = atk;

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setS((prev) => stepSiege(prev, TICK_MS / 1000, atkRef.current, Math.random));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const fighting = s.invaders.some((v) => v.state === 'fight');
  useEffect(() => {
    if (fighting !== fightingRef.current) {
      fightingRef.current = fighting;
      onFighting(fighting);
    }
  }, [fighting, onFighting]);

  if (paused) return null;
  return (
    <div className="siege" style={{ bottom: ground }} aria-hidden>
      {s.invaders.map((v) => (
        <div key={v.id} className="invader" style={{ left: `${v.x}%` }}>
          {v.state !== 'dead' && (
            <span className="inv-hp"><span style={{ width: `${(v.hp / SIEGE.maxHp) * 100}%` }} /></span>
          )}
          <Sprite
            id={v.kind}
            anim={v.state === 'dead' ? 'death' : v.state === 'fight' ? 'attack' : 'idle'}
            className={v.state === 'dead' ? 'once' : v.state === 'walk' ? 'walking' : ''}
            flip={!v.fromLeft}
            scale={0.85}
            label=""
          />
        </div>
      ))}
      <div className="castle-hp" style={{ left: '50%' }}>
        <span style={{ width: `${(s.castleHp / SIEGE.castleMax) * 100}%` }} />
      </div>
      {s.coins.map((c) => {
        // 쓰러진 자리에서 톡 튀어 올라(0~0.3초) 잠깐 떠 있다가(~0.9초) 그 자리에서 사라진다(채집)
        const a = c.age;
        const left = c.x;
        let bottom = `${6 + 28 * Math.min(1, a / 0.3) * (2 - Math.min(1, a / 0.3))}px`;
        let scale = 1;
        let opacity = 1;
        if (a >= 0.3 && a < 0.9) bottom = `${34 + Math.sin((a - 0.3) * 10) * 2}px`;
        if (a >= 0.9) {
          const k = Math.min(1, (a - 0.9) / (SIEGE.coinFor - 0.9));
          bottom = `${34 + k * 8}px`;
          scale = 1 + k * 0.3;
          opacity = 1 - k;
        }
        return (
          <img key={c.id} className="siege-coin" src="icons/gold.png" alt="" draggable={false}
            style={{ left: `${left}%`, bottom, opacity, scale: String(scale) }} />
        );
      })}
    </div>
  );
}
