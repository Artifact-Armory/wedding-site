// The password page, in the invite's style. Contains nothing private.
export function loginPage({ error = false, admin = false }) {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Ellie &amp; Callum</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,400..900,100,1&family=Yellowtail&display=swap" rel="stylesheet">
<style>
:root{--pink:#cc2d86;--red:#b0202a;--rose:#e86aa8;--blush:#f6d3e3;--ink:#5a1630;--serif:"Fraunces",Georgia,serif;--script:"Yellowtail","Brush Script MT",cursive;color-scheme:light}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;min-height:100dvh;display:grid;place-items:center;background:var(--pink);font:17px/1.6 var(--serif);font-variation-settings:"SOFT" 100;color:var(--ink);padding:24px 14px}
.card{width:min(100%,440px);background:#fff;padding:64px 40px 56px;text-align:center}
.script{font-family:var(--script);color:var(--red);font-size:30px;line-height:1.1}
h1{margin:8px 0 4px;font-size:clamp(48px,14vw,64px);line-height:1;color:var(--red);text-transform:uppercase;font-weight:800;font-variation-settings:"SOFT" 100,"WONK" 1}
h1 span{display:block;font-size:.8em}
.date{font-family:var(--script);color:var(--rose);font-size:28px}
svg.sq{display:block;width:110px;height:14px;margin:14px auto 22px;color:var(--rose)}
label{display:block;font-weight:700;color:var(--red);margin-bottom:8px}
input{width:100%;font:18px var(--serif);text-align:center;color:var(--ink);border:2px solid var(--blush);border-radius:999px;padding:12px 18px;min-height:52px}
input:focus{outline:none;border-color:var(--pink);box-shadow:0 0 0 3px rgba(204,45,134,.2)}
button{margin-top:14px;width:100%;min-height:54px;border:0;border-radius:999px;background:var(--pink);color:#fff;font:700 19px var(--serif);cursor:pointer;box-shadow:0 5px 0 var(--red)}
button:focus-visible{outline:3px solid var(--red);outline-offset:3px}
.err{color:var(--red);background:var(--blush);border-radius:14px;padding:10px 12px;font-size:15px;margin:0 0 14px}
.hint{font-size:14px;color:#8a3a5c;margin:14px 0 0}
</style>
</head>
<body>
<main class="card" id="card">
  <div class="script">You're invited to the wedding of</div>
  <h1>Ellie <span>&amp;</span> Callum</h1>
  <div class="date">18th September 2027</div>
  <svg class="sq" viewBox="0 0 120 14" aria-hidden="true"><path d="M2 7q7-7 14 0t14 0 14 0 14 0 14 0 14 0 14 0 14 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
  <form method="post" action="${admin ? "/admin/login" : "/login"}">
    ${error ? '<p class="err" role="alert">That password didn\'t work. ${admin ? "Please try again." : "Please check your invitation and try again."}</p>' : ""}
    <label for="pw">${admin ? "Admin password" : "Enter the password from your invitation"}</label>
    <input id="pw" name="password" type="${admin ? "password" : "text"}" autocomplete="off" autocapitalize="none" spellcheck="false" required autofocus>
    <button type="submit">${admin ? "Open admin" : "Come in"}</button>
  </form>
  ${admin ? '<p class="hint">For Ellie &amp; Callum only.</p>' : ''}
</main>
<script>
{const c=document.getElementById('card');
const wave=(W,H)=>{const a=9,d=20,r=22,K=.5523,f=v=>v.toFixed(1);
 const side=(len,fn)=>{const L=len-2*r,n=Math.max(2,Math.round(L/110)),k=Math.max(24,Math.round(L/4)),o=[];for(let s=0;s<=k;s++){const t=s/k;o.push(fn(r+t*L,a*Math.cos(2*Math.PI*n*t)))}return o};
 const w=W-2*d,hh=H-2*d;
 const T=side(w,(x,o)=>[d+x,d-o]),R=side(hh,(y,o)=>[W-d+o,d+y]),B=side(w,(x,o)=>[W-d-x,H-d+o]),L=side(hh,(y,o)=>[d-o,H-d-y]);
 const seg=p=>p.map(q=>'L'+f(q[0])+' '+f(q[1])).join('');
 const arc=(cx,cy,sx,sy,ex,ey)=>'C'+f(sx+K*(ex-cx))+' '+f(sy+K*(ey-cy))+' '+f(ex+K*(sx-cx))+' '+f(ey+K*(sy-cy))+' '+f(ex)+' '+f(ey);
 const p='M'+f(T[0][0])+' '+f(T[0][1])+seg(T)+arc(W-d-r,d+r,...T.at(-1),...R[0])+seg(R)+arc(W-d-r,H-d-r,...R.at(-1),...B[0])+seg(B)+arc(d+r,H-d-r,...B.at(-1),...L[0])+seg(L)+arc(d+r,d+r,...L.at(-1),...T[0])+'Z';
 return 'url("data:image/svg+xml,'+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='"+W+"' height='"+H+"'><path d='"+p+"'/></svg>")+'")'};
new ResizeObserver(()=>{const m=wave(c.offsetWidth,c.offsetHeight);c.style.webkitMaskImage=c.style.maskImage=m;c.style.webkitMaskSize=c.style.maskSize='100% 100%'}).observe(c);}
</script>
</body>
</html>`;
}
