import { describe, expect, it } from 'vitest';
import { createApi, errorText } from '../src/services/api';

function fakeServer() {
  const calls: string[] = [];
  let release: (v: unknown) => void = () => {};
  return {
    calls,
    finish: (v: unknown) => release(v),
    remoteFunction: (name: string, args: unknown[] = []) => {
      calls.push(`${name}:${JSON.stringify(args)}`);
      return new Promise((r) => { release = r; });
    },
  };
}

describe('api', () => {
  it('dedupes identical in-flight calls', async () => {
    const s = fakeServer();
    const api = createApi(s);
    const a = api.claimIdle();
    const b = api.claimIdle();
    expect(s.calls).toHaveLength(1);
    s.finish({ gold: 5 });
    expect(await a).toEqual({ gold: 5 });
    expect(await b).toEqual({ gold: 5 });
  });

  it('allows the same call again after it finishes', async () => {
    const s = fakeServer();
    const api = createApi(s);
    const a = api.claimIdle();
    s.finish({ gold: 1 });
    await a;
    void api.claimIdle();
    expect(s.calls).toHaveLength(2);
  });

  it('does not dedupe calls with different arguments', () => {
    const s = fakeServer();
    const api = createApi(s);
    void api.upgrade('monster', 'slime');
    void api.upgrade('monster', 'skeleton');
    expect(s.calls).toHaveLength(2);
  });

  it('maps known error codes to Korean', () => {
    expect(errorText(new Error('NO_REVIVE_CREDIT'))).toBe('부활 아이템이 없다');
    expect(errorText(new Error('골드가 부족하다'))).toBe('골드가 부족하다');
    expect(errorText('weird')).toBe('문제가 생겼다. 잠시 후 다시 시도해줘.');
  });
});
