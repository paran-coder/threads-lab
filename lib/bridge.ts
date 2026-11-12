export type Post={id:string,text:string,scheduled_at:string|null,status:string,created_at:string,updated_at:string,sent_at:string|null,published_id:string|null,error:string|null,attempt_count:number};
export type Example={id:string,url:string,content:string,likes:number|null,replies:number|null,views:number|null,created_at:string};
export type Settings={enabled:boolean,intervalMinutes:number,dailyLimit:number,quietStart:string,quietEnd:string,deviceName:string};
export type OwnPost={id:string,text?:string,timestamp?:string,permalink?:string,media_type?:string,username?:string,likes?:number|null,replies?:number|null,views?:number|null};
export type Recommendation={topic:string,reason:string,hook:string};
export type Analysis={summary:string,keywords:string[],insights:string[],recommendations:Recommendation[]};
export type Draft={hook:string,body:string,fullText:string};
const URL='http://127.0.0.1:7330/api';
const KEY='threads-lab:pairing-v1';
let token='',tabId='';
export function initPair(){if(typeof window==='undefined')return;try{const obj=JSON.parse(sessionStorage.getItem(KEY)||'null');if(obj&&/^[a-f0-9]{64}$/.test(obj.token)&&/^[\w-]{1,80}$/.test(obj.tabId)){token=obj.token;tabId=obj.tabId;}}catch{}if(!tabId)tabId=crypto.randomUUID();}
function setPair(value:string){token=value;if(typeof window!=='undefined')sessionStorage.setItem(KEY,JSON.stringify({token,tabId}));}
export function isPaired(){return Boolean(token);}
export async function request<T=Record<string,unknown>>(pathname:string,body:Record<string,unknown>={},timeout=180000):Promise<T>{
  if(typeof window==='undefined')throw new Error('브라우저에서만 연결할 수 있습니다.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const result=await fetch(URL+pathname,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
    const data=await result.json().catch(()=>({error:'브릿지 응답을 읽을 수 없습니다.'}));
    if(!result.ok)throw new Error(data.error||`브릿지 요청 오류 (${result.status})`);
    return data as T;
  }catch(e){if(e instanceof TypeError)throw new Error('PC에서 AI연결앱(7330 포트)을 실행하고 이 사이트를 승인해 주세요.');throw e;}
  finally{clearTimeout(timer);}
}
export async function pair(code:string){initPair();const response=await request<{token:string}>('/pair',{code,tabId},12000);setPair(response.token);return response;}
export async function authorizeSite(onStatus:(text:string)=>void){
  initPair();const secret=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
  const challenge=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
  const uri='nodecanvas://connect?'+new URLSearchParams({origin:location.origin,challenge});
  const link=document.createElement('a');link.href=uri;link.click();onStatus('브릿지앱에서 이 사이트를 승인해 주세요.');
  for(let i=0;i<40;i++){
    try{const answer=await request<{token:string}>('/claim',{secret,tabId},1500);setPair(answer.token);return;}
    catch(e){if(i===39)throw e;await new Promise(r=>setTimeout(r,750));}
  }
}
