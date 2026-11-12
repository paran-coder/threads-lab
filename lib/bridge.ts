export type Post={id:string,text:string,scheduled_at:string|null,status:string,created_at:string,updated_at:string,sent_at:string|null,published_id:string|null,error:string|null,attempt_count:number};
export type Example={id:string,url:string,content:string,likes:number|null,replies:number|null,views:number|null,created_at:string};
export type Settings={enabled:boolean,intervalMinutes:number,dailyLimit:number,quietStart:string,quietEnd:string,deviceName:string};
export type OwnPost={id:string,text?:string,timestamp?:string,permalink?:string,media_type?:string,username?:string,likes?:number|null,replies?:number|null,views?:number|null};
export type Recommendation={topic:string,reason:string,hook:string};
export type Analysis={summary:string,keywords:string[],insights:string[],recommendations:Recommendation[]};
export type Draft={hook:string,body:string,fullText:string};

const URL='http://127.0.0.1:7330/api';
const KEY='threads-lab:pairing-v1';
export const BRIDGE_UPDATE_MESSAGE='현재 설치된 AI연결앱이 Threads 관리 기능을 지원하지 않습니다. Windows 공통 AI연결앱 v1.16.0 이상을 설치하고 다시 연결해 주세요.';
let token='',tabId='';

/** Local bridge tokens are scoped to a browser tab. Never send them to Vercel. */
export function initPair(){
  if(typeof window==='undefined')return;
  try{const obj=JSON.parse(sessionStorage.getItem(KEY)||'null');if(obj&&/^[a-f0-9]{64}$/.test(obj.token)&&/^[\w-]{1,80}$/.test(obj.tabId)){token=obj.token;tabId=obj.tabId;}}catch{}
  if(!tabId)tabId=crypto.randomUUID();
}
function setPair(value:string){token=value;if(typeof window!=='undefined')sessionStorage.setItem(KEY,JSON.stringify({token,tabId}));}
export function clearPair(){token='';if(typeof window!=='undefined')sessionStorage.removeItem(KEY);}
export function isPaired(){return Boolean(token);}

export async function request<T=Record<string,unknown>>(pathname:string,body:Record<string,unknown>={},timeout=180000):Promise<T>{
  if(typeof window==='undefined')throw new Error('브라우저에서만 연결할 수 있습니다.');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch(URL+pathname,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'});
    const data=await response.json().catch(()=>({error:'브릿지 응답을 읽을 수 없습니다.'}));
    if(!response.ok){
      // v1.15.1 can approve a website but has no /api/threads/* routes.
      if(pathname.startsWith('/threads/')&&response.status===404)throw new Error(BRIDGE_UPDATE_MESSAGE);
      if(response.status===401&&pathname.startsWith('/threads/'))throw new Error('브릿지 연결이 만료되었습니다. 다시 연결하기를 눌러 주세요.');
      throw new Error(data.error||`브릿지 요청 오류 (${response.status})`);
    }
    return data as T;
  }catch(e){
    if(e instanceof TypeError)throw new Error('PC의 공통 AI연결앱이 실행 중인지 확인해 주세요. 연결되지 않으면 Windows 브릿지앱 v1.16.0 이상을 설치해 주세요.');
    if(e instanceof Error&&e.name==='AbortError')throw new Error('브릿지앱 응답 시간이 초과되었습니다. PC에서 앱이 실행 중인지 확인해 주세요.');
    throw e;
  }finally{clearTimeout(timer);}
}

export type PreparedConnection={secret:string,challenge:string};
/** Prepare WebCrypto BEFORE the user clicks. External-protocol launch needs a live user gesture. */
export async function prepareConnection():Promise<PreparedConnection>{
  if(typeof window==='undefined')throw new Error('브라우저에서만 연결할 수 있습니다.');
  const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
  const challenge=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  return {secret,challenge};
}

/**
 * Called directly from an onClick with an already-prepared challenge.
 * Browser launches the native app before the first await (user activation preserved).
 * First-time origin approval is still required in Windows; no code is copied or typed.
 */
export async function connectBridge(prepared:PreparedConnection,onStatus:(text:string)=>void):Promise<void>{
  if(typeof window==='undefined')throw new Error('브라우저에서만 연결할 수 있습니다.');
  initPair();
  if(!/^[a-f0-9]{64}$/.test(prepared.secret)||!/^[a-f0-9]{64}$/.test(prepared.challenge))throw new Error('연결 준비값이 올바르지 않습니다. 페이지를 새로고침해 주세요.');
  const uri='nodecanvas://connect?'+new URLSearchParams({origin:location.origin,challenge:prepared.challenge});
  // Native app launch intentionally occurs synchronously inside the original click handler.
  const link=document.createElement('a');link.href=uri;link.style.display='none';document.body.appendChild(link);
  try{link.click();}finally{link.remove();}
  onStatus('Windows에서 공통 AI연결앱을 여는 중입니다. 처음 연결할 때만 웹 주소 승인을 확인해 주세요.');
  let lastError:unknown;
  for(let i=0;i<40;i++){
    try{
      const answer=await request<{token:string}>('/claim',{secret:prepared.secret,tabId},1700);
      if(!/^[a-f0-9]{64}$/.test(answer.token))throw new Error('브릿지앱의 연결 응답이 올바르지 않습니다.');
      setPair(answer.token);
      return;
    }catch(e){
      lastError=e;
      // A recognized 401 is expected until native app approval; other error responses
      // might be old-bridge compatibility failures, so do not hide them indefinitely.
      if(e instanceof Error && /지원하지 않는 요청입니다|지원하지 않는 경로입니다/.test(e.message)){
        throw new Error(BRIDGE_UPDATE_MESSAGE);
      }
      if(i<39)await new Promise(resolve=>setTimeout(resolve,600));
    }
  }
  throw new Error('브릿지앱 연결을 확인하지 못했습니다. Windows 팝업에서 연결을 허용하고 공통 AI연결앱 v1.16.0 이상이 실행 중인지 확인해 주세요.'+(lastError instanceof Error&&lastError.message.includes('허용하지')?' (웹 주소 허용 설정도 확인하세요.)':''));
}
