/*!
 * @name 聚合API接口 (CF)
 * @description v3
 * @version 3
 * @author t.me/JHMS_Channel
 */
let{stringify:t,parse:a}=JSON;let x=(r)=>{throw new Error(r)};let{EVENT_NAMES:n,request:b,on,send:y,version:v}=globalThis.lx;let A='https://api.music.lerd.dpdns.org/';let h=(u,o={method:'GET'})=>new Promise((s,j)=>{b(u,o,(e,r)=>{if(e)return j(e);s(r)})});h(A+'init.conf').then(r=>{if(r.body.code!==200)x("脚本初始化失败");let U=r.body.data;if(U.update.version>v)y(n.updateAlert,U.update);y(n.inited,U.init);}).catch(e=>x(e));on(n.request,async({action,source,info})=>{let r=await h(A+source,{method:'POST',body:t(info),headers:{'Content-Type':'application/json'}});let B=r.body;if(B.code===200)return B.data.url;else if(B.code===303){let S=a(t(B.data));let D=S.request;let F=S.response;try{let z=await h(encodeURI(D.url),D.options);if(F.check.key.reduce((a,c)=>a&&a[c],z)==F.check.value){let u=F.url.reduce((a,c)=>a&&a[c],z);if(u.startsWith("http"))return u;}}catch(e){x(e)}}else x(B.msg);});