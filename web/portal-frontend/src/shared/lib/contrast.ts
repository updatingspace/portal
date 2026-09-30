/** Relative luminance and contrast ratio from WCAG 2.2. Input is an opaque hex color. */
function luminance(hex: string) {
  const channels = [1,3,5].map(offset => parseInt(hex.slice(offset,offset+2),16)/255)
    .map(value => value <= 0.04045 ? value/12.92 : ((value+0.055)/1.055)**2.4);
  return channels[0]*0.2126 + channels[1]*0.7152 + channels[2]*0.0722;
}
export function contrastRatio(first: string, second: string) {
  const a=luminance(first),b=luminance(second);
  return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
export function accessibleAccent(value: string, theme: 'light' | 'dark') {
  const fallback=theme==='dark'?'#9E8CFF':'#7557F5';
  const brand=/^#[a-f\d]{6}$/i.test(value)?value:fallback;
  const surface=theme==='dark'?'#141B2D':'#FFFFFF';
  const text=contrastRatio(brand,'#FFFFFF') >= contrastRatio(brand,'#101527')?'#FFFFFF':'#101527';
  return {brand,text,link:contrastRatio(brand,surface)>=4.5?brand:fallback};
}
