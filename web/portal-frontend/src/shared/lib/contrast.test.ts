import {expect,it} from 'vitest';
import {accessibleAccent,contrastRatio} from './contrast';
it.each(['light','dark'] as const)('keeps arbitrary user accents readable in %s',theme=>{
 for(const value of ['#FFFFFF','#000000','#FFFF00','#FF55AA','#7557F5','bad']){
  const colors=accessibleAccent(value,theme);
  expect(contrastRatio(colors.brand,colors.text)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(colors.link,theme==='dark'?'#141B2D':'#FFFFFF')).toBeGreaterThanOrEqual(4.5);
 }
});
