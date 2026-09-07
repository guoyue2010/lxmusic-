/*!
 * @name 𝖧౿ᥣᥣ𝗈 Ԝ𝗈𝗋ᥣᑯ
 * @author hello world
 * @version 260809
 * @description 缝合怪,轻点喷
 */

const ENABLE_CACHE = true;
const CACHE_TTL = 20 * 60 * 1000;
const TIMEOUT = 10000;
const RACE_APIS = false;
const CONFIG = {
  kw: {
    name: '酷我音乐',
    apis: [
      { 
        api: '', 
        idField: ['rid', 'id', 'songmid', 'hash'], 
        urlField: ['data.url', 'url', 'playUrl'],
        quality: { '128k': '0', '320k': '5', 'flac': '1' }
      }
    ]
  },
  kg: {
    name: '酷狗音乐',
    apis: [
      { 
        api: '', 
        idField: ['hash', 'songmid', 'id', 'rid'], 
        urlField: ['0.url','url', 'data.url', 'playUrl'],
        quality: { '128k': '128', '320k': '320', 'flac': 'flac' }
      }
    ]
  },
  tx: {
    name: 'QQ音乐',
    apis: [
      { 
        api: 'https://a.aa.cab/qq.music?msg={keyword}&n=1&type={quality}', 
        idField: ['songmid', 'id', 'hash'], 
        urlField: ['data.music','playUrl', 'url', 'data.url'],
        quality: { '128k': '0', '320k': '1', 'flac': '4', 'master': '5' }
      }
    ]
  },
  wy: {
    name: '网易云音乐',
    apis: [
      { 
        api: '', 
        idField: ['id', 'songmid', 'hash'], 
        urlField: ['url', 'data.url', 'playUrl'],
        quality: { '128k': 'standard', '320k': 'exhigh', 'flac': 'lossless' ,'hires':'hires','atmos':'jyeffect','atmos_plus':'sky','master':'jymaster'}
      }
    ]
  },
mg: {
  name: '咪咕音乐',
  apis: [
    {
      api: 'https://yy.zddyr.top/lx/api/?source=migu&songmid={id}&quality={quality}',
      idField: ['songmid', 'id', 'hash'],
      urlField: ['url', 'data.url'],
      quality: {
        '128k': '128k',
        '320k': '320k',
        'flac': 'flac'
      }
    }
  ]
}
}

const { EVENT_NAMES, request, on, send } = globalThis.lx;
const cache = Object.create(null);
const sourceKeys = Object.keys(CONFIG);

const getCache = k => ENABLE_CACHE && cache[k]?.expire > Date.now() ? cache[k].data : (delete cache[k], null);
const setCache = (k, d) => ENABLE_CACHE && (cache[k] = { data: d, expire: Date.now() + CACHE_TTL });

const httpRequest = (url, options = {}) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('请求超时')), TIMEOUT);
  request(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36' }, ...options }, (err, resp) => {
    clearTimeout(timer);
    if (err) return reject(err instanceof Error ? err : new Error(String(err)));
    if (!resp) return reject(new Error('空响应'));
    resolve({ body: resp.body, statusCode: resp.statusCode || resp.status || 200, url: resp.url });
  });
});

const getField = (obj, path) => path.split('.').reduce((val, p) => val == null ? undefined
  : Array.isArray(val) ? (/^\d+$/.test(p) ? val[+p] : val.map(v => v?.[p]).find(v => v != null && v !== ''))
  : val[p], obj);

const asUrl = v => typeof v === 'string' && /^(https?:)?\/\//.test(v.trim())
  ? (v.trim().startsWith('//') ? 'https:' + v.trim() : v.trim())
  : null;

const findUrl = (data, fields) => data == null ? null : asUrl(data) || fields.map(f => asUrl(getField(data, f))).find(Boolean) || null;

const getSongId = (info, fields) => fields.map(f => info[f]).find(v => v !== undefined && v !== null && v !== '')?.toString() ?? '';

const qualitys = Object.create(null);
const sources = Object.create(null);
const idFieldsBySource = Object.create(null);
sourceKeys.forEach(s => {
  const apiList = CONFIG[s].apis || [];
  const qs = [...new Set(apiList.flatMap(a => Object.keys(a.quality || {})))];
  qualitys[s] = qs.reduce((acc, q) => (acc[q] = q, acc), {});
  sources[s] = { name: CONFIG[s].name, type: 'music', actions: ['musicUrl'], qualitys: qs };
  idFieldsBySource[s] = [...new Set(apiList.flatMap(a => a.idField || []))];
});
qualitys.local = {};
sources.local = { name: '本地音乐', type: 'music', actions: ['musicUrl', 'lyric', 'pic'], qualitys: [] };

const FALLBACK = {
  master: ['master', 'atmos', 'atmos_plus', 'hires', 'flac24bit', 'flac', '320k', '128k'],
  atmos: ['atmos', 'atmos_plus', 'hires', 'flac24bit', 'flac', '320k', '128k'],
  atmos_plus: ['atmos_plus', 'hires', 'flac24bit', 'flac', '320k', '128k'],
  hires: ['hires', 'flac24bit', 'flac', '320k', '128k'],
  flac24bit: ['flac24bit', 'flac', '320k', '128k'],
  flac: ['flac', '320k', '128k'],
  '320k': ['320k', '128k'],
  '128k': ['128k'],
};

const tryApi = async (s, info, quality) => {
  const apiList = CONFIG[s].apis;
  if (!apiList?.length) throw new Error('无API配置');
  const keyword = encodeURIComponent(info.name || info.songname || '');

  const run = async api => {
    const tag = api.api.split('?')[0].split('/').pop() || 'api';
    if (api.quality && !(quality in api.quality)) throw new Error(`${tag}:不支持${quality}`);
    const needsId = api.api.includes('{id}');
    const needsKeyword = api.api.includes('{keyword}');
    const id = needsId ? getSongId(info, api.idField) : '';
    if (needsId && !id) throw new Error(`${tag}:缺少id字段`);
    if (needsKeyword && !keyword) throw new Error(`${tag}:缺少歌曲名`);
    const url = api.api.replace(/\{id\}/g, id).replace(/\{keyword\}/g, keyword).replace(/\{quality\}/g, api.quality ? api.quality[quality] : quality);
    if (!url || /\{[^}]*\}/.test(url)) throw new Error(`${tag}:URL模板未配置`);
    const resp = await httpRequest(url);
    if ([301, 302, 307, 308].includes(resp.statusCode) && resp.url) {
      const abs = asUrl(resp.url) || (() => { try { return new URL(resp.url, url).href; } catch { return null; } })();
      if (abs) return abs;
    }
    const direct = asUrl(resp.body);
    if (direct) return direct;
    const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
    const result = findUrl(data, api.urlField || ['url', 'data.url', 'playUrl']);
    if (result) return result;
    throw new Error(`${tag}:响应中未找到有效链接`);
  };

  if (RACE_APIS) {
    try { return await Promise.any(apiList.map(run)); }
    catch (agg) { throw new Error(`所有API均失败(${quality}) [${(agg.errors || [agg]).map(e => e.message || String(e)).join(' | ')}]`); }
  }

  const fails = [];
  for (const api of apiList) {
    try { return await run(api); } catch (e) { fails.push(e.message || String(e)); }
  }
  throw new Error(`所有API均失败(${quality}) [${fails.join(' | ')}]`);
};

const inflight = Object.create(null);

const apis = sourceKeys.reduce((acc, s) => {
  acc[s] = {
    async musicUrl(info, quality) {
      if (!info) throw new Error('缺少musicInfo');
      const key = `${s}_${getSongId(info, idFieldsBySource[s]) || `${info.name || ''}-${info.singer || info.artist || ''}` || 'unknown'}_${quality}`;
      const cached = getCache(key);
      if (cached) return cached;
      if (inflight[key]) return inflight[key];

      const run = (async () => {
        const fails = [];
        for (const q of FALLBACK[quality] || [quality]) {
          if (!qualitys[s].hasOwnProperty(q)) continue;
          try {
            const result = await tryApi(s, info, q);
            if (result) { setCache(key, result); return result; }
          } catch (e) { fails.push(e.message || String(e)); }
        }
        throw new Error(fails.length ? fails.join(' || ') : '所有音质均失败');
      })();

      inflight[key] = run;
      try { return await run; } finally { delete inflight[key]; }
    }
  };
  return acc;
}, {});

on(EVENT_NAMES.request, ({ source, action, info } = {}) => {
  if (!apis[source] || action !== 'musicUrl') return Promise.reject('不支持');
  if (!qualitys[source]?.[info?.type]) return Promise.reject(`不支持的音质: ${info?.type}`);
  return apis[source].musicUrl(info.musicInfo, info.type).catch(e => {
    console.error(`[${source}] 失败:`, e.message);
    return Promise.reject(e.message);
  });
});

send(EVENT_NAMES.inited, { openDevTools: false, sources });

;(function() {
  'use strict';

  CONFIG.kg.qualitys = {'128k': '128','320k': '320','flac': 'flac','flac24bit': 'flac24bit','atmos': 'atmos','atmos_plus': 'atmos_plus','hires': 'hires','master': 'master'};
  CONFIG.kw.qualitys = { '128k': '128', '320k': '320', 'flac': 'flac' };

  const API_URL = "https://88.lxmusic.xn--fiqs8s";
  const API_KEY = "lxmusic";
  const SECRET_KEY = 'JaJ?a7Nwk_Fgj?2o:znAkst';
  const SCRIPT_MD5 = '1888f9865338afe6d5534b35171c61a4';
  const KG_QUALITY_LIST = ['master', 'flac24bit', 'flac', '320k', '128k'];
  const KW_QUALITY_LIST = ['flac', '320k', '128k'];
  const MUSIC_SOURCE = ['kg', 'kw'];

  const sha256 = (function() {
    var HEX_CHARS = '0123456789abcdef'.split('');
    function Sha256() {
      this.blocks = [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
      this.h0 = 0x6a09e667;
      this.h1 = 0xbb67ae85;
      this.h2 = 0x3c6ef372;
      this.h3 = 0xa54ff53a;
      this.h4 = 0x510e527f;
      this.h5 = 0x9b05688c;
      this.h6 = 0x1f83d9ab;
      this.h7 = 0x5be0cd19;
      this.block = this.start = this.bytes = this.hBytes = 0;
      this.finalized = this.hashed = false;
      this.first = true;
    }
    Sha256.prototype.update = function(message) {
      if (this.finalized) return;
      var notString = typeof message !== 'string';
      var blocks = this.blocks;
      for (var i = 0; i < message.length; i++) {
        if (this.hashed) {
          this.hashed = false;
          blocks[0] = this.block;
          blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
        }
        var code = notString ? message[i] : message.charCodeAt(i);
        blocks[this.start >> 2] |= code << (24 - (this.start % 4) * 8);
        this.start++;
        if (this.start === 64) {
          this.block = blocks[16];
          this.start = 0;
          this.hash();
          this.hashed = true;
        }
      }
      this.bytes += message.length;
      if (this.bytes > 4294967295) {
        this.hBytes += this.bytes / 4294967296 << 0;
        this.bytes = this.bytes % 4294967296;
      }
      return this;
    };
    Sha256.prototype.finalize = function() {
      if (this.finalized) return;
      this.finalized = true;
      var blocks = this.blocks;
      var i = this.start;
      blocks[16] = this.block;
      blocks[i >> 2] |= 0x80 << (24 - (i % 4) * 8);
      this.block = blocks[16];
      if (i >= 56) {
        if (!this.hashed) this.hash();
        blocks[0] = this.block;
        blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
      }
      blocks[14] = this.hBytes << 3 | this.bytes >>> 29;
      blocks[15] = this.bytes << 3;
      this.hash();
    };
    Sha256.prototype.hash = function() {
      var K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
      var a = this.h0, b = this.h1, c = this.h2, d = this.h3, e = this.h4, f = this.h5, g = this.h6, h = this.h7, blocks = this.blocks;
      for (var j = 0; j < 64; j++) {
        if (j >= 16) {
          var w0 = blocks[j - 15];
          var w1 = blocks[j - 2];
          var s0 = ((w0 >>> 7) | (w0 << 25)) ^ ((w0 >>> 18) | (w0 << 14)) ^ (w0 >>> 3);
          var s1 = ((w1 >>> 17) | (w1 << 15)) ^ ((w1 >>> 19) | (w1 << 13)) ^ (w1 >>> 10);
          blocks[j] = blocks[j - 16] + s0 + blocks[j - 7] + s1;
        }
        var S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        var ch = (e & f) ^ ((~e) & g);
        var temp1 = h + S1 + ch + K[j] + (blocks[j] >>> 0);
        var S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = S0 + maj;
        h = g; g = f; f = e; e = (d + temp1) >>> 0; d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      this.h0 = (this.h0 + a) >>> 0;
      this.h1 = (this.h1 + b) >>> 0;
      this.h2 = (this.h2 + c) >>> 0;
      this.h3 = (this.h3 + d) >>> 0;
      this.h4 = (this.h4 + e) >>> 0;
      this.h5 = (this.h5 + f) >>> 0;
      this.h6 = (this.h6 + g) >>> 0;
      this.h7 = (this.h7 + h) >>> 0;
    };
    Sha256.prototype.hex = function() {
      this.finalize();
      var h0 = this.h0, h1 = this.h1, h2 = this.h2, h3 = this.h3, h4 = this.h4, h5 = this.h5, h6 = this.h6, h7 = this.h7;
      return HEX_CHARS[(h0 >> 28) & 0x0F] + HEX_CHARS[(h0 >> 24) & 0x0F] + HEX_CHARS[(h0 >> 20) & 0x0F] + HEX_CHARS[(h0 >> 16) & 0x0F] + HEX_CHARS[(h0 >> 12) & 0x0F] + HEX_CHARS[(h0 >> 8) & 0x0F] + HEX_CHARS[(h0 >> 4) & 0x0F] + HEX_CHARS[h0 & 0x0F] + HEX_CHARS[(h1 >> 28) & 0x0F] + HEX_CHARS[(h1 >> 24) & 0x0F] + HEX_CHARS[(h1 >> 20) & 0x0F] + HEX_CHARS[(h1 >> 16) & 0x0F] + HEX_CHARS[(h1 >> 12) & 0x0F] + HEX_CHARS[(h1 >> 8) & 0x0F] + HEX_CHARS[(h1 >> 4) & 0x0F] + HEX_CHARS[h1 & 0x0F] + HEX_CHARS[(h2 >> 28) & 0x0F] + HEX_CHARS[(h2 >> 24) & 0x0F] + HEX_CHARS[(h2 >> 20) & 0x0F] + HEX_CHARS[(h2 >> 16) & 0x0F] + HEX_CHARS[(h2 >> 12) & 0x0F] + HEX_CHARS[(h2 >> 8) & 0x0F] + HEX_CHARS[(h2 >> 4) & 0x0F] + HEX_CHARS[h2 & 0x0F] + HEX_CHARS[(h3 >> 28) & 0x0F] + HEX_CHARS[(h3 >> 24) & 0x0F] + HEX_CHARS[(h3 >> 20) & 0x0F] + HEX_CHARS[(h3 >> 16) & 0x0F] + HEX_CHARS[(h3 >> 12) & 0x0F] + HEX_CHARS[(h3 >> 8) & 0x0F] + HEX_CHARS[(h3 >> 4) & 0x0F] + HEX_CHARS[h3 & 0x0F] + HEX_CHARS[(h4 >> 28) & 0x0F] + HEX_CHARS[(h4 >> 24) & 0x0F] + HEX_CHARS[(h4 >> 20) & 0x0F] + HEX_CHARS[(h4 >> 16) & 0x0F] + HEX_CHARS[(h4 >> 12) & 0x0F] + HEX_CHARS[(h4 >> 8) & 0x0F] + HEX_CHARS[(h4 >> 4) & 0x0F] + HEX_CHARS[h4 & 0x0F] + HEX_CHARS[(h5 >> 28) & 0x0F] + HEX_CHARS[(h5 >> 24) & 0x0F] + HEX_CHARS[(h5 >> 20) & 0x0F] + HEX_CHARS[(h5 >> 16) & 0x0F] + HEX_CHARS[(h5 >> 12) & 0x0F] + HEX_CHARS[(h5 >> 8) & 0x0F] + HEX_CHARS[(h5 >> 4) & 0x0F] + HEX_CHARS[h5 & 0x0F] + HEX_CHARS[(h6 >> 28) & 0x0F] + HEX_CHARS[(h6 >> 24) & 0x0F] + HEX_CHARS[(h6 >> 20) & 0x0F] + HEX_CHARS[(h6 >> 16) & 0x0F] + HEX_CHARS[(h6 >> 12) & 0x0F] + HEX_CHARS[(h6 >> 8) & 0x0F] + HEX_CHARS[(h6 >> 4) & 0x0F] + HEX_CHARS[h6 & 0x0F] + HEX_CHARS[(h7 >> 28) & 0x0F] + HEX_CHARS[(h7 >> 24) & 0x0F] + HEX_CHARS[(h7 >> 20) & 0x0F] + HEX_CHARS[(h7 >> 16) & 0x0F] + HEX_CHARS[(h7 >> 12) & 0x0F] + HEX_CHARS[(h7 >> 8) & 0x0F] + HEX_CHARS[(h7 >> 4) & 0x0F] + HEX_CHARS[h7 & 0x0F];
    };
    return function(message) {
      return new Sha256().update(message).hex();
    };
  })();

  const generateSign = (requestPath) => sha256(requestPath + SCRIPT_MD5 + SECRET_KEY);

  const getSongId = (source, musicInfo) => {
    if (source === 'kg') return musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;
    if (source === 'kw') return musicInfo.rid ?? musicInfo.id ?? musicInfo.songmid ?? musicInfo.hash;
    return musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;
  };

  const httpFetch = (url, options = { method: 'GET' }) => {
    const isFullUrl = url.startsWith('http');
    if (!isFullUrl) {
      const requestPath = url;
      const sign = generateSign(requestPath);
      url = `${API_URL}${requestPath}?sign=${sign}`;
    }
    return new Promise((resolve, reject) => {
      request(url, {
        method: options.method || 'GET',
        headers: {
          'accept': 'application/json',
          'x-request-key': API_KEY,
          'user-agent': `${globalThis.lx.env ? `lx-music-${globalThis.lx.env}/${globalThis.lx.version}` : 'lx-music-request/2.0.0'}`
        },
        ...options
      }, (err, resp, body) => {
        if (err) return reject(err);
        const statusCode = resp ? (resp.statusCode || resp.status || 200) : 200;
        resolve({ statusCode, body: body || (resp ? resp.body : null), headers: resp ? resp.headers : {} });
      });
    });
  };

  const handleGetMusicUrl = async (source, musicInfo, quality) => {
    const songId = getSongId(source, musicInfo);
    if (!songId) throw new Error('找不到歌曲ID');
    const requestPath = `/lxmusicv4/url/${source}/${songId}/${quality}`;
    const response = await httpFetch(requestPath);
    const { body, statusCode } = response;
    if (statusCode === 404) throw new Error('API端点不存在');
    if (statusCode >= 500) throw new Error(`服务器错误(${statusCode})`);
    if (!body) throw new Error('服务器返回空响应');
    const data = typeof body === 'string' ? JSON.parse(body) : body;
    if (!data || isNaN(Number(data.code))) throw new Error('无效的响应数据');
    switch (data.code) {
      case 0:
      case 200:
        const musicUrl = data.data || data.url;
        if (musicUrl) return musicUrl;
        throw new Error('响应中未找到有效的URL');
      case 1:
        throw new Error('block ip');
      case 2:
        throw new Error(data.msg || 'get music url failed');
      case 5:
        throw new Error('too many requests');
      default:
        throw new Error(data.msg ?? `Unknown error(code:${data.code})`);
    }
  };

  apis.kg = {
    async musicUrl(info, quality) {
      const id = getSongId('kg', info);
      const key = `kg_${id || info.name || 'unknown'}_${quality}`;
      const cached = getCache(key);
      if (cached) return cached;
      
      const idx = KG_QUALITY_LIST.indexOf(quality);
      const qList = idx >= 0 ? KG_QUALITY_LIST.slice(idx) : [quality];
      
      for (const q of qList) {
        try {
          const result = await handleGetMusicUrl('kg', info, q);
          setCache(key, result);
          return result;
        } catch (e) { continue; }
      }
      throw '所有音质均失败';
    }
  };

  apis.kw = {
    async musicUrl(info, quality) {
      const id = getSongId('kw', info);
      const key = `kw_${id || info.name || 'unknown'}_${quality}`;
      const cached = getCache(key);
      if (cached) return cached;
      
      const idx = KW_QUALITY_LIST.indexOf(quality);
      const qList = idx >= 0 ? KW_QUALITY_LIST.slice(idx) : [quality];
      
      for (const q of qList) {
        try {
          const result = await handleGetMusicUrl('kw', info, q);
          setCache(key, result);
          return result;
        } catch (e) { continue; }
      }
      throw '所有音质均失败';
    }
  };

  sources.kg = { name: '酷狗母带', type: 'music', actions: ['musicUrl'], qualitys: KG_QUALITY_LIST };
  sources.kw = { name: '酷我无损', type: 'music', actions: ['musicUrl'], qualitys: KW_QUALITY_LIST };

  qualitys.kg = KG_QUALITY_LIST.reduce((acc, q) => { acc[q] = q; return acc; }, {});
  qualitys.kw = KW_QUALITY_LIST.reduce((acc, q) => { acc[q] = q; return acc; }, {});

})();

;(function() {
  'use strict';

  var WY_QUALITY_LIST = ['master', 'hires', 'flac24bit', 'flac', '320k', '128k'];

  function tryApi(url, body) {
    return new Promise(function(resolve, reject) {
      var timer = setTimeout(function() {
        reject('请求超时');
      }, 10000);

      request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
        },
        body: body
      }, function(err, resp) {
        clearTimeout(timer);
        if (err) {
          reject(err);
          return;
        }
        try {
          var data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body;
          if (data.code === 200 && data.url) {
            resolve(data.url);
            return;
          }
        } catch (e) {}
        reject('未找到播放链接');
      });
    });
  }

  apis.wy = {
    async musicUrl(info, quality) {
      var id = info.songmid || info.songId || info.id;
      if (!id) throw new Error('网易云歌曲ID不存在');

      var key = 'wy_' + id + '_' + quality;
      var cached = getCache(key);
      if (cached) return cached;

      var fallbackList = [];
      var idx = WY_QUALITY_LIST.indexOf(quality);
      if (idx >= 0) {
        fallbackList = WY_QUALITY_LIST.slice(idx);
      } else {
        fallbackList = ['128k'];
      }

      for (var i = 0; i < fallbackList.length; i++) {
        var q = fallbackList[i];
        var body = {
          source: 'wy',
          musicId: id,
          quality: q
        };

        try {
          var result = await tryApi('https://c.wwwweb.top/music/url', body);
          if (result) {
            setCache(key, result);
            return result;
          }
        } catch (e) {
          continue;
        }
      }

      throw new Error('网易云所有音质均失败');
    }
  };

  sources.wy = {
    name: '网易云音乐',
    type: 'music',
    actions: ['musicUrl'],
    qualitys: WY_QUALITY_LIST
  };

  qualitys.wy = {};
  for (var i = 0; i < WY_QUALITY_LIST.length; i++) {
    var q = WY_QUALITY_LIST[i];
    qualitys.wy[q] = q;
  }
})();