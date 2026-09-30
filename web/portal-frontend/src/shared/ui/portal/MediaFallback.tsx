import {useState} from 'react';
export function MediaFallback({src,alt}:{src?:string|null;alt:string}){
 const [failedSource,setFailedSource]=useState<string|null>(null);
 return <div className="portal-media">{src&&failedSource!==src?<img src={src} alt={alt} loading="lazy" onError={()=>setFailedSource(src)}/>:<div role="img" aria-label={alt} className="portal-media__fallback"><span aria-hidden="true">{alt.slice(0,2).toUpperCase()}</span></div>}</div>;
}
