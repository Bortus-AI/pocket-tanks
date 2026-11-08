import { damp, dampAngle, spring } from './motion';

test('suspension and recoil settle identically at different frame rates', () => {
    const simulate = fps => {
        let position=0,velocity=35,recoil=3.5;
        for(let i=0;i<fps;i++) { [position,velocity]=spring(position,velocity,16,1/fps);recoil=damp(recoil,0,17,1/fps); }
        return {position,velocity,recoil};
    };
    const reference=simulate(60);
    for(const fps of [30,120])for(const key of Object.keys(reference))expect(simulate(fps)[key]).toBeCloseTo(reference[key],10);
    expect(Math.abs(reference.position)).toBeLessThan(.001);
    expect(Math.abs(reference.velocity)).toBeLessThan(.001);
});

test('aim smoothing takes the short path across the full-circle boundary', () => {
    const start=Math.PI*2-.02,result=dampAngle(start,.02,32,1/60);
    expect(result).toBeGreaterThan(start);
    expect(result-start).toBeLessThan(.04);
    expect(dampAngle(.4,.4,32,1/60)).toBe(.4);
});
