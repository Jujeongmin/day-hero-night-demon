import { dayKey } from './state';

/**
 * 리텐션 집계(2026-10-14 사용자: 관리자가 콘솔에서 본다). 계산만 하고 데이터는 server.ts adminRetention이 모은다.
 * - 바로 볼 수 있는 값(예전 계정 포함): 가입 후 N일이 지나서도 접속한 비율(롤링 리텐션). 마지막 접속 = 기록된 것 중 가장 늦은 시각
 * - 정확한 값(접속한 날 기록을 시작한 뒤 가입한 계정만): 가입한 날 기준 정확히 N일째에 접속한 비율(D1·D3·D7)
 */

/** 관리자 계정(Verse8 계정 주소). 조회는 이 계정만 부를 수 있다 */
export const ADMINS: string[] = ['0x7b47Aa40357441418909f83728Da906b7C85d261'];

/** 관리자인가(주소 대소문자는 가리지 않는다) */
export function isAdmin(account: string): boolean {
  return ADMINS.some((a) => a.toLowerCase() === account.toLowerCase());
}

/** 접속한 날 기록을 남기는 최대 일수(오래된 것부터 뺀다) */
export const ACTIVE_DAYS_KEEP = 60;

export interface PlayerActivity {
  createdAt: number;
  /** 마지막 접속(추정 포함) */
  lastSeenAt: number;
  /** 접속한 날(dayKey). 기록을 시작하기 전 계정은 비어 있거나 일부만 */
  activeDays: string[];
  /** 이탈 지점용 진행 정보(없으면 표에서 '?') */
  progress?: { stage: string; best: number; castle: number; wins: number; guide: number };
}

/** 이탈 지점 표: 차원 → 묶음 → 다시 안 온 사람·다시 온 사람 수 */
export type Dropoff = Record<string, Record<string, { left: number; stayed: number }>>;

const bucket = (n: number, edges: number[], labels: string[]) => labels[edges.findIndex((e) => n < e)] ?? labels[labels.length - 1];

/**
 * 이탈 지점(2026-10-14 사용자): 가입한 지 하루가 지난 사람을 "하루 뒤에도 다시 왔는가"로 나눠, 마지막 상태가 어디였는지 묶는다.
 * 다시 안 온 사람의 마지막 진행이 곧 그만둔 지점이다
 */
export function dropoff(players: PlayerActivity[], now: number): Dropoff {
  const out: Dropoff = { stage: {}, playMinutes: {}, best: {}, castle: {}, wins: {}, guide: {} };
  const add = (dim: string, key: string, stayed: boolean) => {
    const row = (out[dim][key] ??= { left: 0, stayed: 0 });
    if (stayed) row.stayed += 1; else row.left += 1;
  };
  for (const p of players) {
    if (now - p.createdAt < DAY) continue;
    const stayed = p.lastSeenAt - p.createdAt >= DAY;
    const g = p.progress;
    add('stage', g?.stage ?? '?', stayed);
    add('playMinutes', bucket((p.lastSeenAt - p.createdAt) / 60_000, [3, 10, 30, 60, 24 * 60], ['3분 미만', '3~10분', '10~30분', '30~60분', '1시간~하루', '하루 이상']), stayed);
    if (!g) continue;
    add('best', bucket(g.best, [5, 10, 20, 30, 50], ['1~4', '5~9', '10~19', '20~29', '30~49', '50+']), stayed);
    add('castle', `성 ${g.castle}`, stayed);
    add('wins', bucket(g.wins, [1, 3, 10, 30], ['0승', '1~2승', '3~9승', '10~29승', '30승+']), stayed);
    add('guide', bucket(g.guide, [1, 3, 6, 10, 15], ['0개', '1~2개', '3~5개', '6~9개', '10~14개', '15개+']), stayed);
  }
  return out;
}

const DAY = 86_400_000;
const addDays = (day: string, n: number) => dayKey(Date.parse(`${day}T00:00:00+09:00`) + n * DAY);

export interface RetentionReport {
  players: number;
  today: string;
  /** 오늘·어제 접속한 계정 수, 최근 7일 접속 계정 수 */
  dau: { today: number; yesterday: number; last7: number };
  /** 롤링: 가입 후 N일이 지난 계정 중 N일 이후에도 접속한 비율(%) */
  rolling: Record<'d1' | 'd3' | 'd7', { eligible: number; returned: number; pct: number }>;
  /** 정확한 Day-N: 기록 시작(trackingSince) 뒤 가입한 계정만 */
  exact: Record<'d1' | 'd3' | 'd7', { eligible: number; returned: number; pct: number }>;
  /** 가입한 날별 묶음: 가입 수와 D1·D3·D7(아직 그날이 안 왔으면 null) */
  cohorts: { day: string; joined: number; d1: number | null; d3: number | null; d7: number | null }[];
  dropoff: Dropoff;
}

const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 1000) / 10);

export function retentionReport(players: PlayerActivity[], now: number, trackingSince: string): RetentionReport {
  const today = dayKey(now);
  const yesterday = addDays(today, -1);
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)));
  const N = { d1: 1, d3: 3, d7: 7 } as const;
  const rolling = {} as RetentionReport['rolling'];
  const exact = {} as RetentionReport['exact'];
  for (const k of ['d1', 'd3', 'd7'] as const) {
    const n = N[k];
    const old = players.filter((p) => now - p.createdAt >= n * DAY);
    const back = old.filter((p) => p.lastSeenAt - p.createdAt >= n * DAY);
    rolling[k] = { eligible: old.length, returned: back.length, pct: pct(back.length, old.length) };
    const tracked = players.filter((p) => dayKey(p.createdAt) >= trackingSince && addDays(dayKey(p.createdAt), n) <= today);
    const hit = tracked.filter((p) => p.activeDays.includes(addDays(dayKey(p.createdAt), n)));
    exact[k] = { eligible: tracked.length, returned: hit.length, pct: pct(hit.length, tracked.length) };
  }
  const byDay = new Map<string, PlayerActivity[]>();
  for (const p of players) {
    const d = dayKey(p.createdAt);
    byDay.set(d, [...(byDay.get(d) ?? []), p]);
  }
  const cohorts = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 14)
    .map(([day, ps]) => {
      const at = (n: number) => {
        const target = addDays(day, n);
        if (target > today || day < trackingSince) return null;
        return pct(ps.filter((p) => p.activeDays.includes(target)).length, ps.length);
      };
      return { day, joined: ps.length, d1: at(1), d3: at(3), d7: at(7) };
    });
  return {
    players: players.length,
    today,
    dau: {
      today: players.filter((p) => p.activeDays.includes(today)).length,
      yesterday: players.filter((p) => p.activeDays.includes(yesterday)).length,
      last7: players.filter((p) => p.activeDays.some((d) => week.has(d)) || now - p.lastSeenAt < 7 * DAY).length,
    },
    rolling,
    exact,
    cohorts,
    dropoff: dropoff(players, now),
  };
}

/** 접속한 날 기록을 시작한 날(이날부터 가입한 계정만 정확한 Day-N에 넣는다) */
export const TRACKING_SINCE = '2026-10-14';

/** 오늘 접속을 기록할 값(UserState.seen). 바뀔 게 없으면 null(같은 날 10분 안에는 다시 쓰지 않는다) */
export function seenPatch(seen: { days: string[]; at: number } | undefined, now: number): { days: string[]; at: number } | null {
  const today = dayKey(now);
  const days = seen?.days ?? [];
  if (days.includes(today) && now - (seen?.at ?? 0) < 10 * 60_000) return null;
  return { days: days.includes(today) ? days : [...days, today].slice(-ACTIVE_DAYS_KEEP), at: now };
}
