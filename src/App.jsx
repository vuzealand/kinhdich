import { useState, useRef, useCallback } from "react";
import { TRIGRAMS, HEXAGRAMS, HEXAGRAM_LOOKUP } from "./hexagrams.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";
const LINE_NAMES=['Sơ','Nhị','Tam','Tứ','Ngũ','Thượng'];
const MH_MAP={1:'111',2:'011',3:'101',4:'001',5:'110',6:'010',7:'100',8:'000'};
const VIET_NAME={'111':'Thiên','000':'Địa','001':'Lôi','110':'Phong','010':'Thủy','101':'Hỏa','100':'Sơn','011':'Trạch'};
function jdn(d,m,y){let a=Math.floor((14-m)/12),yy=y+4800-a,mm=m+12*a-3;let jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-Math.floor(yy/100)+Math.floor(yy/400)-32045;if(jd<2299161)jd=d+Math.floor((153*mm+2)/5)+365*yy+Math.floor(yy/4)-32083;return jd}
function nmJD(k){let T=k/1236.85,T2=T*T,r=Math.PI/180;let J=2415020.75933+29.53058868*k+.0001178*T2+.00033*Math.sin((166.56+132.87*T)*r);let M=359.2242+29.10535608*k,Mp=306.0253+385.81691806*k+.0107306*T2,F=21.2964+390.67050646*k-.0016528*T2;let C=(.1734-.000393*T)*Math.sin(M*r)+.0021*Math.sin(2*r*M)-.4068*Math.sin(Mp*r)+.0161*Math.sin(2*r*Mp)+.0104*Math.sin(2*r*F)-.0051*Math.sin(r*(M+Mp))-.0074*Math.sin(r*(M-Mp))+.0004*Math.sin(r*(2*F+M))-.0004*Math.sin(r*(2*F-M))-.0006*Math.sin(r*(2*F+Mp))+.001*Math.sin(r*(2*F-Mp))+.0005*Math.sin(r*(2*Mp+M));let dt=T<-11?.001+.000839*T+.0002261*T2:-.000278+.000265*T+.000262*T2;return J+C-dt}
function sL(jd){let T=(jd-2451545)/36525,r=Math.PI/180,M=357.5291+35999.0503*T,L=(280.46645+36000.76983*T+(1.9146-.004817*T)*Math.sin(r*M)+.019993*Math.sin(2*r*M)+.00029*Math.sin(3*r*M))*r;L-=Math.PI*2*Math.floor(L/(Math.PI*2));return Math.floor(L/Math.PI*6)}
function gLM11(y){let o=jdn(31,12,y)-2415021,k=Math.floor(o/29.530588853),n=nmJD(k);if(sL(n+.29)>=9)n=nmJD(k-1);return Math.floor(n+.5)}
function gLMO(a){let k=Math.floor((a-2415021.076998695)/29.530588853+.5),l=0,i=1,cc=sL(nmJD(k+i)+.29);do{l=cc;i++;cc=sL(nmJD(k+i)+.29)}while(cc!==l&&i<14);return i-1}
function s2l(d,m,y){let n=jdn(d,m,y),k=Math.floor((n-2415021.076998695)/29.530588853),s=Math.floor(nmJD(k)+.5);if(s>n)s=Math.floor(nmJD(k-1)+.5);let a=gLM11(y),b=a,ly;if(a>=s){ly=y;a=gLM11(y-1)}else{ly=y+1;b=gLM11(y+1)}let ld=n-s+1,df=Math.floor((s-a)/29),ll=0,lm=df+11;if(b-a>365){let lo=gLMO(a);if(df>=lo){lm=df+10;if(df===lo)ll=1}}if(lm>12)lm-=12;if(lm>=11&&df<4)ly-=1;return{day:ld,month:lm,year:ly}}
function hIdx(h){return h>=23||h<1?0:Math.floor((h-1)/2)+1}
// hào array: ALWAYS bottom-to-top. hao[0]=hào Sơ(1), hao[5]=hào Thượng(6)
// trigram keys in TRIGRAMS: top-to-bottom. So we reverse when converting.
function h2t(h0,h1,h2){return''+h2+h1+h0}
function haoLookup(hao){const lo=h2t(hao[0],hao[1],hao[2]),up=h2t(hao[3],hao[4],hao[5]);const i=HEXAGRAM_LOOKUP[up+lo];return i!==undefined?HEXAGRAMS[i]:null}
function calcHo(hao){const lo=h2t(hao[1],hao[2],hao[3]),up=h2t(hao[2],hao[3],hao[4]);const i=HEXAGRAM_LOOKUP[up+lo];return i!==undefined?HEXAGRAMS[i]:null}
function calcBien(hao,mv){if(!mv||!mv.length)return null;const nh=hao.map((v,i)=>mv.includes(i)?(1-v):v);return haoLookup(nh)}
function maiHoa(uNum,lNum,total){const uu=((uNum-1)%8)+1,ll=((lNum-1)%8)+1;const uB=MH_MAP[uu],lB=MH_MAP[ll];const hao=[+lB[2],+lB[1],+lB[0],+uB[2],+uB[1],+uB[0]];const mvH=total%6===0?6:total%6;const mv=[mvH-1];const lines=hao.map((v,i)=>({value:mv.includes(i)?(v?9:6):(v?7:8)}));return{hao,moving:mv,lines,chinh:haoLookup(hao),bien:calcBien(hao,mv),queHo:calcHo(hao)}}
function nowTS(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')+' '+d.getDate()+'/'+(d.getMonth()+1)+'/'+d.getFullYear()}
function shortQ(h){if(!h)return'';const p=h[1].split(' ');return p[p.length-1]}
function hoHao(r){return r.queHo&&r.hao?[r.hao[1],r.hao[2],r.hao[3],r.hao[2],r.hao[3],r.hao[4]]:null}
function bienHao(r){return r.bien&&r.hao?r.hao.map((v,i)=>r.moving.includes(i)?(1-v):v):null}
