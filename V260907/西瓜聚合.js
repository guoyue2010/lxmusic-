/*!
 * @name 西瓜聚合源
 * @description 聚合星海/溯音/CHKSZ/长青/念心/Huibq等10+API后端，多源自动回退
 * @version v1.40
 * @author 整合自多个音源
 */

// ==================== 全局常量 ====================
var lx = globalThis.lx;
var EVENT_NAMES = lx.EVENT_NAMES;
var request = lx.request;
var on = lx.on;
var send = lx.send;
var currentScriptInfo = lx.currentScriptInfo || {};
var env = lx.env || 'desktop';
var version = lx.version || '';

// ==================== 配置区 ====================

// --- 可选源开关（设为 false 则跳过，不配置 API 则自动跳过）---
var HUIBQ_ENABLE = true;
var FISH_ENABLE = true;
var HYW_ENABLE = true;

// --- 云端版本检查地址 ---
var VERSION_CHECK_URL = 'https://yy.fangqihang.cn/?api=1&type=lx';

// --- 调用日志上传地址（设为空则禁用）---
var LOG_API_URL = 'https://yy.fangqihang.cn/';

// 日志上报（异步，不阻塞请求）
function sendLog(platform, apiName, durationMs) {
  if (!LOG_API_URL) return;
  var body = 'action=log&plugin_type=lx&platform=' + encodeURIComponent(platform) + '&api_name=' + encodeURIComponent(apiName) + '&duration_ms=' + durationMs;
  httpRequest(LOG_API_URL, {
    method: 'POST',
    timeout: 3000,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body
  }).catch(function () { /* 静默忽略 */ });
}

// --- API 端点 ---
// 星海主API（全平台，动态稳定源）
var XINGHAI_MAIN = 'https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light';

// 星海备API（降级备用）
var XINGHAI_BACKUP = 'https://music-dl.sayqz.com/api/';

// CHKSZ（网易云专用，支持高音质+音质降级）
var CHKSZ_API = 'https://api.chksz.top/api';

// 溯音系列
var SUYIN_QQ_API = 'https://oiapi.net/api/QQ_Music';
var SUYIN_QQ_KEY = 'oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575';
var SUYIN_163_API = 'https://oiapi.net/api/Music_163';
var SUYIN_KW_API = 'https://oiapi.net/api/Kuwo';
var SUYIN_MG_API = 'https://api.xcvts.cn/api/music/migu';

// 长青SVIP URL模板
var CHANGQING = {
  tx: 'http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}',
  wy: 'http://175.27.166.236/wy/wy.php?type=mp3&id={id}&level={level}',
  kw: 'https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={level}',
  kg: 'https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}',
  mg: 'https://music.haitangw.cc/musicapi/mg.php?type=mp3&id={id}&level={level}'
};

// 念心SVIP URL模板
var NIANXIN = {
  tx: 'https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3',
  wy: 'http://music.nxinxz.com/wy.php?id={id}&level={level}&type=mp3',
  kw: 'http://music.nxinxz.com/kw.php?id={id}&level={level}&type=mp3',
  kg: 'https://music.nxinxz.com/kgqq/kg.php?id={id}&level={level}&type=mp3',
  mg: 'http://music.nxinxz.com/mg.php?id={id}&level={level}&type=mp3'
};

// Huibq（需配置 KEY，设为空则自动跳过）
var HUIBQ_API = HUIBQ_ENABLE ? 'https://lxmusicapi.onrender.com' : '';
var HUIBQ_KEY = 'share-v3';

// fish-music（需配置 API 地址）
var FISH_API = FISH_ENABLE ? 'https://m-api.ceseet.me' : '';
var FISH_KEY = '';

// HYWmusic（内置卡密认证）
var HYW_API = HYW_ENABLE ? 'https://music.bxa241d4.shop' : '';
var HYW_CARD_KEY = 'TF-VSS0-8Y73-U1AW-GEXJ';

// 收集の聚合接口（独立API集合）
var SHOUJI_TX_API = 'https://cyapi.top/API/qq_music.php?apikey=1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1&type=json';
var SHOUJI_WY_API = 'https://api.cenguigui.cn/api/netease/music_v1.php';
var SHOUJI_KW_API = 'https://kw-api.cenguigui.cn';

// 汽水VIP
var QISHUI_API = 'https://api.vsaa.cn/api/music.qishui.vip';
var QISHUI_API_HTTP = 'http://api.vsaa.cn/api/music.qishui.vip';

// 聚合API（通用 POST 代理，有专用 /kg 接口）
var JUHE_API = 'https://api.music.lerd.dpdns.org';

// 星海备用搜索接口（zrcdy，搜索式回退，支持 kg/tx/mg）
var ZRCDY_API = 'https://zrcdy.dpdns.org/lx/api/api.php';

// ==================== 音质映射表 ====================

// 标准音质 → 星海API br参数
var QUALITY_BR_MAP = {
  '128k': '128',
  '320k': '320',
  'flac': '740',
  'flac24bit': '999'
};

// 标准音质 → 溯音QQ br码率
var QUALITY_SUYIN_QQ_BR = {
  '128k': 7,
  '320k': 5,
  'flac': 4,
  'flac24bit': 1
};

// 标准音质 → 溯音酷我 br
var QUALITY_SUYIN_KW_BR = {
  '128k': 7,
  '320k': 5,
  'flac': 1,
  'flac24bit': 1
};

// 标准音质 → CHKSZ level
var QUALITY_CHKSZ_LEVEL = {
  '128k': 'standard',
  '320k': 'exhigh',
  'flac': 'lossless',
  'flac24bit': 'jymaster'
};

// CHKSZ 音质降级链
var CHKSZ_FALLBACK = {
  jymaster: ['jymaster', 'lossless', 'exhigh', 'standard'],
  lossless: ['lossless', 'exhigh', 'standard'],
  exhigh: ['exhigh', 'standard'],
  standard: ['standard']
};

// 标准音质 → 长青/念心/收集网易 level
function qualityToLevel(quality) {
  var q = String(quality || '128k').toLowerCase();
  if (q === 'flac' || q === 'flac24bit') return 'lossless';
  if (q === '320k') return 'exhigh';
  return 'standard';
}

// 平台名称 → 星海 API source参数
var PLATFORM_SOURCE_MAP = {
  wy: 'netease',
  tx: 'tencent',
  kw: 'kuwo',
  kg: 'kugou',
  mg: 'migu'
};

// 各平台支持的音质（仅4种标准值）
var PLATFORM_QUALITIES = {
  wy: ['128k', '320k', 'flac', 'flac24bit'],
  tx: ['128k', '320k', 'flac', 'flac24bit'],
  kw: ['128k', '320k', 'flac'],
  kg: ['128k', '320k', 'flac', 'flac24bit'],
  mg: ['128k', '320k', 'flac']
};

var PLATFORM_NAMES = {
  wy: '网易云音乐',
  tx: 'QQ音乐',
  kw: '酷我音乐',
  kg: '酷狗音乐',
  mg: '咪咕音乐'
};

// ==================== 缓存模块 ====================
var urlCache = new Map();
var CACHE_TTL = 21600000; // 6小时
var CACHE_MAX = 500;

function cacheGet(key) {
  var entry = urlCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp >= CACHE_TTL) {
    urlCache.delete(key);
    return null;
  }
  return entry.url;
}

function cacheSet(key, url) {
  if (urlCache.size >= CACHE_MAX) {
    var oldestKey = urlCache.keys().next().value;
    if (oldestKey !== undefined) urlCache.delete(oldestKey);
  }
  urlCache.set(key, { url: url, timestamp: Date.now() });
}

// ==================== HTTP 工具函数 ====================
// 核心请求封装，严格使用(err, resp, body)三参数回调
function httpRequest(url, options) {
  options = options || {};
  var method = options.method || 'GET';
  var timeout = options.timeout || 10000;
  var headers = options.headers || {};

  return new Promise(function (resolve, reject) {
    request(url, {
      method: method,
      timeout: timeout,
      headers: extend({ 'Accept': 'application/json' }, headers),
      body: options.body || undefined,
      follow_max: options.follow_max || 2
    }, function (err, resp, body) {
      if (err) return reject(new Error('请求错误: ' + (err.message || err)));
      var statusCode = resp ? resp.statusCode : 0;
      if (statusCode >= 400) return reject(new Error('HTTP ' + statusCode));
      resolve({ statusCode: statusCode, headers: resp ? resp.headers || {} : {}, body: body });
    });
  });
}

// 简单属性合并（避免 Object.assign 在移动版不可用）
function extend(target, source) {
  var result = {};
  var key;
  for (key in target) {
    if (target.hasOwnProperty(key)) result[key] = target[key];
  }
  for (key in source) {
    if (source.hasOwnProperty(key)) result[key] = source[key];
  }
  return result;
}

// 发起GET请求，拼接参数，返回解析后的body
function httpGet(url, params, extraHeaders, timeout) {
  params = params || {};
  extraHeaders = extraHeaders || {};
  timeout = timeout || 10000;
  var keys = Object.keys(params).filter(function (k) {
    return params[k] !== undefined && params[k] !== null;
  });
  var queryStr = keys.map(function (k) {
    return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
  }).join('&');
  var fullUrl = url + (queryStr ? (url.indexOf('?') >= 0 ? '&' : '?') + queryStr : '');

  return httpRequest(fullUrl, { method: 'GET', timeout: timeout, headers: extraHeaders })
    .then(function (res) {
      var body = res.body;
      if (typeof body === 'string') {
        var trimmed = body.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try { body = JSON.parse(trimmed); } catch (e) {}
        }
      }
      return body;
    });
}

// URL验证（增强版：检测音频大小，过滤几秒的假链接）
// 最低音频大小阈值（字节）：128kbps 约 16KB/s，10秒≈160KB，取 150KB 为下限
var MIN_AUDIO_SIZE = 800 * 1024;

function validateUrl(url, sourceName) {
  if (!url || typeof url !== 'string') {
    throw new Error((sourceName || '未知源') + ' 返回空URL');
  }
  var trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error((sourceName || '未知源') + ' URL格式非法');
  }
  return trimmed;
}

// 深度验证：HEAD 请求检测音频文件大小，过滤短音频假链接
function deepValidateUrl(url, sourceName) {
  return new Promise(function (resolve, reject) {
    request(url, {
      method: 'HEAD',
      timeout: 5000,
      follow_max: 2
    }, function (err, resp) {
      if (err) {
        // HEAD 失败不阻止，直接返回 URL（信任源）
        return resolve(url);
      }
      var headers = resp ? resp.headers || {} : {};
      var contentLength = parseInt(headers['content-length'] || headers['Content-Length'] || '0', 10);

      // 有大小信息且过小 → 假链接
      if (contentLength > 0 && contentLength < MIN_AUDIO_SIZE) {
        return reject(new Error((sourceName || '未知源') + ' 音频过小(' + (contentLength / 1024) + 'KB)，疑似假链接'));
      }

      // 无大小信息或大小正常 → 通过
      resolve(url);
    });
  });
}

// ==================== 歌曲信息工具函数 ====================

// 通用歌曲ID提取
function getSongId(songInfo) {
  if (!songInfo) return '';
  return String(songInfo.songmid || songInfo.hash || songInfo.id || songInfo.songId || songInfo.rid || songInfo.mid || '');
}

// 获取hash或songmid（酷狗等平台用）
function getHashOrMid(songInfo) {
  if (!songInfo) return null;
  return songInfo.hash || songInfo.songmid || songInfo.id || null;
}

// QQ歌曲ID（mid优先，然后songid）
function getQqSongId(songInfo) {
  if (!songInfo) return null;
  var mid = (songInfo.meta && songInfo.meta.qq && songInfo.meta.qq.mid) ||
            (songInfo.meta && songInfo.meta.mid) ||
            songInfo.songmid ||
            (typeof songInfo.id === 'string' && !/^\d+$/.test(songInfo.id) ? songInfo.id : null);
  if (mid) return { type: 'mid', value: mid };
  var songid = (songInfo.meta && songInfo.meta.qq && songInfo.meta.qq.songid) ||
               (songInfo.meta && songInfo.meta.songid) ||
               songInfo.id;
  if (songid) {
    var numId = typeof songid === 'number' ? songid : (/^\d+$/.test(String(songid)) ? Number(songid) : null);
    if (numId) return { type: 'songid', value: numId };
  }
  return null;
}

// 文本清洗（去除括号/空格/特殊符号，转小写）
function cleanText(text) {
  if (!text) return '';
  return String(text)
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+/g, '')
    .replace(/[【】《》"'·,，。!！?？:：;；\/\\|\-]/g, '')
    .trim()
    .toLowerCase();
}

// 构建搜索关键词列表（按严格度排序）
function buildSearchKeywords(songInfo) {
  if (!songInfo) return [];
  var keywords = [];
  var name = songInfo.name || '';
  var singer = songInfo.singer || '';
  var album = songInfo.albumName || songInfo.album || '';

  if (name && singer) {
    keywords.push({ keyword: name + ' ' + singer, strict: true });
  }
  if (name && album) {
    keywords.push({ keyword: name + ' ' + album, strict: true });
  }
  if (name) {
    keywords.push({ keyword: name, strict: false });
  }
  return keywords;
}

// 歌曲名匹配
function titleMatch(a, b) {
  var ca = cleanText(a);
  var cb = cleanText(b);
  if (!ca || !cb) return true;
  return ca.indexOf(cb) >= 0 || cb.indexOf(ca) >= 0;
}

// 歌曲信息匹配验证
function checkSongMatch(apiName, apiArtist, musicInfo) {
  if (!titleMatch(apiName, musicInfo.name || '')) return false;
  if (musicInfo.singer && apiArtist) {
    if (!titleMatch(apiArtist, musicInfo.singer)) return false;
  }
  return true;
}

// 从message字符串提取URL
function extractUrlFromMsg(msg) {
  if (!msg) return null;
  var m = String(msg).match(/https?:\/\/[^\s"'<>]+/);
  return m ? m[0] : null;
}

// 从响应中提取URL（通用）
function extractUrl(body) {
  if (!body) return null;
  if (typeof body === 'string') {
    var trimmed = body.trim();
    if (trimmed.startsWith('http')) return trimmed;
    try {
      var parsed = JSON.parse(trimmed);
      return parsed.url || (parsed.data && parsed.data.url) || extractUrlFromMsg(trimmed);
    } catch (e) {
      return extractUrlFromMsg(trimmed);
    }
  }
  if (typeof body === 'object') {
    if (body.url) return body.url;
    if (body.data) {
      if (typeof body.data === 'string' && /^https?:\/\//i.test(body.data)) return body.data;
      if (body.data.url) return body.data.url;
      if (Array.isArray(body.data) && body.data[0] && body.data[0].url) return body.data[0].url;
    }
  }
  return null;
}

// ==================== Provider 函数层 ====================

// --- 8.1 星海主API (全平台) ---
function xinghaiMainGetUrl(platform, songInfo, quality) {
  var source = PLATFORM_SOURCE_MAP[platform];
  if (!source) throw new Error('星海主不支持: ' + platform);
  var id = getSongId(songInfo);
  if (!id) throw new Error('星海主缺少歌曲ID');
  var br = QUALITY_BR_MAP[quality] || '320';

  var url = XINGHAI_MAIN + '&types=url&source=' + source + '&id=' + encodeURIComponent(id) + '&br=' + br;
  return httpGet(url, {}, {}, 15000).then(function (body) {
    var resultUrl = extractUrl(body);
    if (!resultUrl) throw new Error('星海主未返回URL');
    return resultUrl;
  });
}

// --- 8.2 星海备API (降级备用，支持wy/tx/kw) ---
function xinghaiBackupGetUrl(platform, songInfo, quality) {
  var source = PLATFORM_SOURCE_MAP[platform];
  if (!source) throw new Error('星海备不支持: ' + platform);
  var id = getSongId(songInfo);
  if (!id) throw new Error('星海备缺少歌曲ID');

  return httpGet(XINGHAI_BACKUP, {
    source: source,
    id: id,
    type: 'url',
    br: quality
  }, {}, 15000).then(function (body) {
    var resultUrl = extractUrl(body);
    if (!resultUrl) throw new Error('星海备未返回URL');
    return resultUrl;
  });
}

// --- 8.3 CHKSZ (网易云专用，带音质降级) ---
function chkszGetUrl(songInfo, quality) {
  var id = getSongId(songInfo);
  if (!id) throw new Error('CHKSZ缺少ID');
  var level = QUALITY_CHKSZ_LEVEL[quality] || 'standard';
  var levels = CHKSZ_FALLBACK[level] || ['standard'];

  function tryLevel(index) {
    if (index >= levels.length) return Promise.reject(new Error('CHKSZ所有音质失败'));
    var lv = levels[index];
    return httpGet(CHKSZ_API + '/163_music', { id: id, level: lv },
      { 'Referer': 'https://cp.chksz.top/' }, 12000
    ).then(function (body) {
      if (body && body.code === 200 && body.data && body.data.url) {
        return body.data.url;
      }
      throw new Error('CHKSZ音质' + lv + '失败');
    }).catch(function () {
      return tryLevel(index + 1);
    });
  }

  return tryLevel(0);
}

// --- 8.4 溯音QQ (QQ音乐专用，带码率降级) ---
function suyinQQGetUrl(songInfo, quality) {
  var qqId = getQqSongId(songInfo);
  if (!qqId) throw new Error('溯音QQ缺少歌曲ID');
  var startBr = QUALITY_SUYIN_QQ_BR[quality] || 5;
  // 去重&排序
  var brList = [];
  [startBr, 4, 5, 7].forEach(function (v) {
    if (brList.indexOf(v) < 0) brList.push(v);
  });
  brList.sort(function (a, b) { return a - b; });

  function tryBr(index) {
    if (index >= brList.length) return Promise.reject(new Error('溯音QQ所有码率失败'));
    var br = brList[index];
    var params = { key: SUYIN_QQ_KEY, type: 'json', br: br, n: 1 };
    if (qqId.type === 'mid') {
      params.mid = qqId.value;
    } else {
      params.songid = qqId.value;
    }
    return httpGet(SUYIN_QQ_API, params, {}, 12000).then(function (body) {
      var url = extractUrl(body);
      if (!url) throw new Error('溯音QQ未找到链接');
      return url;
    }).catch(function () {
      return tryBr(index + 1);
    });
  }

  return tryBr(0);
}

// --- 8.5 溯音163 (网易云专用) ---
function suyin163GetUrl(songInfo) {
  var id = getSongId(songInfo);
  if (!id) throw new Error('溯音163缺少ID');
  return httpGet(SUYIN_163_API, { id: id }, {}, 12000).then(function (body) {
    var data = body;
    if (data && data.code === 0 && data.data) {
      var item = Array.isArray(data.data) ? data.data[0] : data.data;
      if (item && item.url) return item.url;
    }
    throw new Error('溯音163获取失败');
  });
}

// --- 8.6 溯音酷我 (搜索式，带歌曲匹配) ---
function suyinKwGetUrl(songInfo, quality) {
  if (!songInfo || !songInfo.name) throw new Error('溯音酷我需要歌曲名');
  var br = QUALITY_SUYIN_KW_BR[quality] || 1;
  var keywords = buildSearchKeywords(songInfo);

  function tryKeyword(index) {
    if (index >= keywords.length) return Promise.reject(new Error('溯音酷我失败'));
    var item = keywords[index];
    return httpGet(SUYIN_KW_API, { msg: item.keyword, n: 1, br: br }, {}, 12000).then(function (body) {
      var url = extractUrl(body);
      if (!url) throw new Error('溯音酷我未找到链接');
      if (item.strict) {
        // 提取返回的歌曲名和歌手名用于验证
        var song = (body && body.data && body.data.song) || (body && body.song) || '';
        var singer = (body && body.data && body.data.singer) || (body && body.singer) || '';
        if (song && !checkSongMatch(song, singer, songInfo)) {
          throw new Error('溯音酷我歌曲不匹配');
        }
      }
      return url;
    }).catch(function () {
      return tryKeyword(index + 1);
    });
  }

  return tryKeyword(0);
}

// --- 8.7 溯音咪咕 (搜索式) ---
function suyinMgGetUrl(songInfo) {
  if (!songInfo || !songInfo.name) throw new Error('溯音咪咕需要歌曲名');
  var keywords = buildSearchKeywords(songInfo);

  function tryKeyword(index) {
    if (index >= keywords.length) return Promise.reject(new Error('溯音咪咕失败'));
    var item = keywords[index];
    return httpGet(SUYIN_MG_API, { gm: item.keyword, n: 1, num: 1, type: 'json' }, {}, 12000).then(function (body) {
      if (body && body.code === 200) {
        var url = body.music_url || body.musicInfo || extractUrl(body);
        if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
          if (item.strict) {
            var title = body.title || '';
            var artist = body.artist || '';
            if (title && !checkSongMatch(title, artist, songInfo)) {
              throw new Error('溯音咪咕歌曲不匹配');
            }
          }
          return url;
        }
      }
      throw new Error('溯音咪咕未找到链接');
    }).catch(function () {
      return tryKeyword(index + 1);
    });
  }

  return tryKeyword(0);
}

// --- 8.8 长青SVIP (全平台 URL 模板) ---
function changqingGetUrl(platform, songInfo, quality) {
  var tpl = CHANGQING[platform];
  if (!tpl) throw new Error('长青不支持: ' + platform);
  var id = getSongId(songInfo);
  if (!id) throw new Error('长青缺少歌曲ID');
  var level = qualityToLevel(quality);
  var url = tpl.replace('{id}', encodeURIComponent(id)).replace('{level}', encodeURIComponent(level));
  return httpGet(url, {}, {}, 15000).then(function (body) {
    var resultUrl = extractUrl(body);
    if (!resultUrl) throw new Error('长青未返回URL');
    return resultUrl;
  });
}

// --- 8.9 念心SVIP (全平台 URL 模板) ---
function nianxinGetUrl(platform, songInfo, quality) {
  var tpl = NIANXIN[platform];
  if (!tpl) throw new Error('念心不支持: ' + platform);
  var id = getSongId(songInfo);
  if (!id) throw new Error('念心缺少歌曲ID');
  var level = qualityToLevel(quality);
  var url = tpl.replace('{id}', encodeURIComponent(id)).replace('{level}', encodeURIComponent(level));
  return httpGet(url, {}, {}, 15000).then(function (body) {
    var resultUrl = extractUrl(body);
    if (!resultUrl) throw new Error('念心未返回URL');
    return resultUrl;
  });
}

// --- 8.10 Huibq (全平台，可选) ---
function huibqGetUrl(platform, songInfo, quality) {
  if (!HUIBQ_API || !HUIBQ_KEY) throw new Error('Huibq未配置');
  var songId = getHashOrMid(songInfo) || getSongId(songInfo);
  if (!songId) throw new Error('Huibq缺少歌曲ID');
  var userAgent = env ? 'lx-music-' + env + '/' + version : 'lx-music-request/' + version;
  return httpGet(
    HUIBQ_API + '/url/' + platform + '/' + encodeURIComponent(songId) + '/' + quality,
    {},
    { 'Content-Type': 'application/json', 'User-Agent': userAgent, 'X-Request-Key': HUIBQ_KEY },
    12000
  ).then(function (body) {
    if (!body || isNaN(Number(body.code))) throw new Error('Huibq未知响应');
    switch (Number(body.code)) {
      case 0: return body.url || (body.data && body.data.url);
      case 1: throw new Error('Huibq IP被封');
      case 2: throw new Error('Huibq获取失败');
      case 4: throw new Error('Huibq服务器错误');
      case 5: throw new Error('Huibq请求过多');
      case 6: throw new Error('Huibq参数错误');
      default: throw new Error(body.msg || 'Huibq未知错误');
    }
  });
}

// --- 8.11 fish-music (全平台，可选) ---
function fishGetUrl(platform, songInfo, quality) {
  if (!FISH_API) throw new Error('fish-music未配置');
  var songId = getHashOrMid(songInfo) || getSongId(songInfo);
  if (!songId) throw new Error('fish-music缺少歌曲ID');
  var userAgent = env ? 'lx-music-' + env + '/' + version : 'lx-music-request/' + version;
  var headers = {
    'Content-Type': 'application/json',
    'User-Agent': userAgent
  };
  if (FISH_KEY) headers['X-Request-Key'] = FISH_KEY;
  return httpGet(
    FISH_API + '/url/' + platform + '/' + encodeURIComponent(songId) + '/' + quality,
    {},
    headers,
    12000
  ).then(function (body) {
    if (body && body.code === 0 && body.data && body.data.url) return body.data.url;
    if (body && body.url) return body.url;
    throw new Error('fish-music获取失败');
  });
}

// --- 8.12 收集の聚合接口 (tx/wy/kw) ---
function shoujiGetUrl(platform, songInfo, quality) {
  var songId = getSongId(songInfo);
  if (!songId) throw new Error('收集聚合缺少歌曲ID');
  var level = qualityToLevel(quality);
  var url;

  switch (platform) {
    case 'tx':
      url = SHOUJI_TX_API + '&mid=' + encodeURIComponent(songId);
      break;
    case 'wy':
      url = SHOUJI_WY_API + '?id=' + encodeURIComponent(songId) + '&type=json&level=' + encodeURIComponent(level);
      break;
    case 'kw':
      url = SHOUJI_KW_API + '?id=' + encodeURIComponent(songId) + '&type=song&format=json&level=' + encodeURIComponent(level);
      break;
    default:
      throw new Error('收集聚合不支持: ' + platform);
  }

  return httpGet(url, {}, {}, 12000).then(function (body) {
    if (platform === 'tx') {
      return body.url || (body.data && body.data.url);
    }
    return (body.data && body.data.url) || body.url;
  }).then(function (resultUrl) {
    if (!resultUrl) throw new Error('收集聚合未返回URL');
    return resultUrl;
  });
}

// --- 8.13 HYWmusic (全平台，可选) ---
function hywGetUrl(platform, songInfo, quality) {
  if (!HYW_API) throw new Error('HYWmusic未配置');
  var songId = getSongId(songInfo);
  if (!songId) throw new Error('HYWmusic缺少歌曲ID');

  return httpGet(
    HYW_API + '/api/music/url',
    { source: platform, songId: songId, quality: quality },
    {
      'X-Script-Version': 'HYWmusic_beta',
      'X-Card-Key': HYW_CARD_KEY
    },
    12000
  ).then(function (body) {
    if (!body || typeof body !== 'object') throw new Error('HYWmusic响应异常');
    if (body.code !== 200) throw new Error('HYWmusic: ' + (body.msg || '获取失败'));
    return body.url || (body.data && body.data.url);
  }).then(function (resultUrl) {
    if (!resultUrl) throw new Error('HYWmusic未返回URL');
    return resultUrl;
  });
}

// --- 8.14 汽水VIP (网易云/QQ平台，可选) ---
function qishuiGetUrl(songInfo, quality) {
  var songId = getSongId(songInfo);
  if (!songId) throw new Error('汽水VIP缺少歌曲ID');
  var q = '128k';

  // 将标准音质映射为汽水API参数
  switch (quality) {
    case 'flac24bit':
    case 'flac': q = 'lossless'; break;
    case '320k': q = 'exhigh'; break;
    default: q = 'standard'; break;
  }

  function tryApi(url) {
    return httpGet(url, { act: 'song', id: songId, quality: q }, {}, 15000).then(function (body) {
      var data = body;
      if (Array.isArray(data && data.data)) data = data.data[0] || data;
      else if (data && data.data) data = data.data;
      if (!data || !data.url) throw new Error('汽水VIP未返回URL');
      return String(data.url);
    });
  }

  return tryApi(QISHUI_API).catch(function () {
    return tryApi(QISHUI_API_HTTP);
  });
}

// --- 8.15 聚合API（POST 代理接口，使用独立 /kg 端点） ---
function juheGetUrl(platform, songInfo, quality) {
  if (!JUHE_API) throw new Error('聚合API未配置');
  var songId = getSongId(songInfo);
  if (!songId) throw new Error('聚合API缺少歌曲ID');

  return httpRequest(JUHE_API + '/' + platform, {
    method: 'POST',
    timeout: 12000,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'musicUrl',
      source: platform,
      info: { musicInfo: songInfo, type: quality }
    })
  }).then(function (res) {
    var body = typeof res.body === 'string' ? JSON.parse(res.body) : res.body;
    if (body && body.code === 200 && body.data && body.data.url) {
      return body.data.url;
    }
    // 支持 303 重定向模式
    if (body && body.code === 303 && body.data) {
      var redirectInfo = typeof body.data === 'string' ? JSON.parse(body.data) : body.data;
      if (redirectInfo && redirectInfo.request && redirectInfo.response) {
        var req = redirectInfo.request;
        var resp = redirectInfo.response;
        return httpRequest(encodeURI(req.url), req.options || {}).then(function (respResult) {
          var respBody = respResult.body;
          if (typeof respBody === 'string' && (respBody.startsWith('{') || respBody.startsWith('['))) {
            try { respBody = JSON.parse(respBody); } catch (e) {}
          }
          var checkOk = true;
          if (resp.check && resp.check.key && Array.isArray(resp.check.key)) {
            var cursor = respBody;
            for (var ci = 0; ci < resp.check.key.length; ci++) {
              if (cursor && cursor[resp.check.key[ci]]) { cursor = cursor[resp.check.key[ci]]; }
              else { checkOk = false; break; }
            }
            if (checkOk && cursor !== resp.check.value) checkOk = false;
          }
          if (checkOk && resp.url && Array.isArray(resp.url.key)) {
            var urlCursor = respBody;
            for (var ui = 0; ui < resp.url.key.length; ui++) {
              if (urlCursor && urlCursor[resp.url.key[ui]]) { urlCursor = urlCursor[resp.url.key[ui]]; }
              else { checkOk = false; break; }
            }
            if (checkOk && typeof urlCursor === 'string' && urlCursor.indexOf('http') === 0) return urlCursor;
          }
          throw new Error('聚合API 303模式失败');
        });
      }
    }
    throw new Error('聚合API: ' + (body && body.msg || '获取失败'));
  });
}

// --- 8.16 星海备用搜索接口（zrcdy，搜索式回退，支持 kg/tx/mg） ---
function zrcdyGetUrl(platform, songInfo, quality) {
  if (!ZRCDY_API) throw new Error('zrcdy未配置');
  var name = songInfo.name || '';
  var singer = songInfo.singer || '';
  if (!name) throw new Error('zrcdy需要歌曲名');

  var backupSourceMap = { kg: 'kg', tx: 'qq', mg: 'migu' };
  var backupSource = backupSourceMap[platform];
  if (!backupSource) throw new Error('zrcdy不支持: ' + platform);

  var keywords = buildSearchKeywords(songInfo);

  function searchKeyword(index) {
    if (index >= keywords.length) return Promise.reject(new Error('zrcdy所有搜索词失败'));
    var kw = keywords[index];
    var searchUrl = ZRCDY_API + '?source=' + backupSource + '&msg=' + encodeURIComponent(kw.keyword) + '&n=0&g=10';
    return httpGet(searchUrl, {}, {}, 12000).then(function (body) {
      if (!body || body.code !== 200 || !body.data || !body.data.songs || !body.data.songs.length) {
        throw new Error('zrcdy搜索无结果');
      }
      var songs = body.data.songs;
      var bestN = 1;
      if (kw.strict && singer) {
        var bestScore = -1;
        for (var si = 0; si < songs.length; si++) {
          var sName = songs[si].title || songs[si].name || '';
          var sSinger = songs[si].singer || songs[si].author || '';
          var nScore = (cleanText(sName).indexOf(cleanText(name)) >= 0 || cleanText(name).indexOf(cleanText(sName)) >= 0) ? 0.6 : 0;
          var sScore = (cleanText(sSinger).indexOf(cleanText(singer)) >= 0 || cleanText(singer).indexOf(cleanText(sSinger)) >= 0) ? 0.4 : 0;
          var total = nScore + sScore;
          if (total > bestScore) { bestScore = total; bestN = si + 1; }
        }
        if (bestScore < 0.3) throw new Error('zrcdy歌曲匹配度低');
      }

      var qMap = { '128k': '128', '192k': '192', '320k': '320', 'flac': 'flac', 'flac24bit': 'flac' };
      var apiQuality = qMap[quality] || '320';
      var detailUrl = ZRCDY_API + '?source=' + backupSource + '&msg=' + encodeURIComponent(kw.keyword) + '&n=' + bestN + '&quality=' + apiQuality;
      return httpGet(detailUrl, {}, {}, 12000).then(function (detailBody) {
        if (!detailBody || detailBody.code !== 200) throw new Error('zrcdy获取详情失败');
        var data = detailBody.data;
        var musicUrl = (data && (data.play_url || data.music_url || data.url || data.musicurl)) || '';
        if (!musicUrl) throw new Error('zrcdy未返回URL');
        return musicUrl;
      });
    }).catch(function () {
      return searchKeyword(index + 1);
    });
  }

  return searchKeyword(0);
}

// ==================== 回退链定义 ====================

// 每个平台一条回退链，按优先级排列
// required: 必选源始终在链中；false为可选源，未配置时过滤掉
var CHAIN_TEMPLATES = {
  wy: [
    { name: 'CHKSZ',      fn: function (si, q) { return chkszGetUrl(si, q); },              required: true },
    { name: '星海主',      fn: function (si, q) { return xinghaiMainGetUrl('wy', si, q); },  required: true },
    { name: '溯音163',     fn: function (si, q) { return suyin163GetUrl(si); },              required: true },
    { name: '长青SVIP',    fn: function (si, q) { return changqingGetUrl('wy', si, q); },    required: true },
    { name: '收集聚合',    fn: function (si, q) { return shoujiGetUrl('wy', si, q); },       required: true },
    { name: '念心SVIP',    fn: function (si, q) { return nianxinGetUrl('wy', si, q); },      required: true },
    { name: '星海备',      fn: function (si, q) { return xinghaiBackupGetUrl('wy', si, q); }, required: true },
    { name: 'Huibq',       fn: function (si, q) { return huibqGetUrl('wy', si, q); },        required: false },
    { name: 'HYWmusic',    fn: function (si, q) { return hywGetUrl('wy', si, q); },          required: false },
    { name: 'fish-music',  fn: function (si, q) { return fishGetUrl('wy', si, q); },         required: false },
    { name: '汽水VIP',     fn: function (si, q) { return qishuiGetUrl(si, q); },             required: false }
  ],
  tx: [
    { name: '溯音QQ',      fn: function (si, q) { return suyinQQGetUrl(si, q); },            required: true },
    { name: '星海主',      fn: function (si, q) { return xinghaiMainGetUrl('tx', si, q); },  required: true },
    { name: '长青SVIP',    fn: function (si, q) { return changqingGetUrl('tx', si, q); },    required: true },
    { name: '收集聚合',    fn: function (si, q) { return shoujiGetUrl('tx', si, q); },       required: true },
    { name: '念心SVIP',    fn: function (si, q) { return nianxinGetUrl('tx', si, q); },      required: true },
    { name: '星海备',      fn: function (si, q) { return xinghaiBackupGetUrl('tx', si, q); }, required: true },
    { name: 'Huibq',       fn: function (si, q) { return huibqGetUrl('tx', si, q); },        required: false },
    { name: 'HYWmusic',    fn: function (si, q) { return hywGetUrl('tx', si, q); },          required: false },
    { name: 'fish-music',  fn: function (si, q) { return fishGetUrl('tx', si, q); },         required: false },
    { name: '汽水VIP',     fn: function (si, q) { return qishuiGetUrl(si, q); },             required: false }
  ],
  kw: [
    { name: '星海主',      fn: function (si, q) { return xinghaiMainGetUrl('kw', si, q); },  required: true },
    { name: '溯音酷我',    fn: function (si, q) { return suyinKwGetUrl(si, q); },            required: true },
    { name: '长青SVIP',    fn: function (si, q) { return changqingGetUrl('kw', si, q); },    required: true },
    { name: '收集聚合',    fn: function (si, q) { return shoujiGetUrl('kw', si, q); },       required: true },
    { name: '念心SVIP',    fn: function (si, q) { return nianxinGetUrl('kw', si, q); },      required: true },
    { name: '星海备',      fn: function (si, q) { return xinghaiBackupGetUrl('kw', si, q); }, required: true },
    { name: 'Huibq',       fn: function (si, q) { return huibqGetUrl('kw', si, q); },        required: false },
    { name: 'HYWmusic',    fn: function (si, q) { return hywGetUrl('kw', si, q); },          required: false },
    { name: 'fish-music',  fn: function (si, q) { return fishGetUrl('kw', si, q); },         required: false }
  ],
  kg: [
    { name: '聚合API',     fn: function (si, q) { return juheGetUrl('kg', si, q); },         required: true },
    { name: '长青SVIP',    fn: function (si, q) { return changqingGetUrl('kg', si, q); },    required: true },
    { name: 'zrcdy备用',   fn: function (si, q) { return zrcdyGetUrl('kg', si, q); },        required: true },
    { name: '念心SVIP',    fn: function (si, q) { return nianxinGetUrl('kg', si, q); },      required: true },
    { name: '星海主',      fn: function (si, q) { return xinghaiMainGetUrl('kg', si, q); },  required: true },
    { name: '星海备',      fn: function (si, q) { return xinghaiBackupGetUrl('kg', si, q); }, required: true },
    { name: 'Huibq',       fn: function (si, q) { return huibqGetUrl('kg', si, q); },        required: false },
    { name: 'HYWmusic',    fn: function (si, q) { return hywGetUrl('kg', si, q); },          required: false },
    { name: 'fish-music',  fn: function (si, q) { return fishGetUrl('kg', si, q); },         required: false }
  ],
  mg: [
    { name: '星海主',      fn: function (si, q) { return xinghaiMainGetUrl('mg', si, q); },  required: true },
    { name: '溯音咪咕',    fn: function (si, q) { return suyinMgGetUrl(si); },               required: true },
    { name: '长青SVIP',    fn: function (si, q) { return changqingGetUrl('mg', si, q); },    required: true },
    { name: '念心SVIP',    fn: function (si, q) { return nianxinGetUrl('mg', si, q); },      required: true },
    { name: '星海备',      fn: function (si, q) { return xinghaiBackupGetUrl('mg', si, q); }, required: true },
    { name: 'Huibq',       fn: function (si, q) { return huibqGetUrl('mg', si, q); },        required: false },
    { name: 'HYWmusic',    fn: function (si, q) { return hywGetUrl('mg', si, q); },          required: false },
    { name: 'fish-music',  fn: function (si, q) { return fishGetUrl('mg', si, q); },         required: false }
  ]
};

// 动态构建回退链（过滤未配置的可选源）
function buildChain(platform) {
  var template = CHAIN_TEMPLATES[platform];
  if (!template) return [];

  return template.filter(function (handler) {
    if (handler.required) return true;
    if (handler.name === 'Huibq') return !!(HUIBQ_API && HUIBQ_KEY);
    if (handler.name === 'HYWmusic') return !!HYW_API;
    if (handler.name === 'fish-music') return !!FISH_API;
    if (handler.name === '汽水VIP') return !!QISHUI_API;
    return false;
  });
}

// ==================== 核心回退引擎 ====================

function getUrlWithFallback(platform, songInfo, quality) {
  var chain = buildChain(platform);
  if (!chain.length) return Promise.reject(new Error('无可用回退链: ' + platform));

  // 检查缓存
  var cacheKey = 'url_' + platform + '_' + getSongId(songInfo) + '_' + quality;
  var cached = cacheGet(cacheKey);
  if (cached) return Promise.resolve(cached);

  var errors = [];
  var startTime = Date.now();

  // Phase 1: 前N个源并发竞速（kg平台全部并发，其他平台前3个）
  function phase1() {
    var n = (platform === 'kg') ? chain.length : Math.min(3, chain.length);
    var concurrent = chain.slice(0, n);
    var promises = concurrent.map(function (handler) {
      return handler.fn(songInfo, quality).then(function (url) {
        var validUrl = validateUrl(url, handler.name);
        return deepValidateUrl(validUrl, handler.name);
      }).then(function (url) {
        // 返回带源名称的包装对象，用于 promise.any 竞速识别
        return { url: url, name: handler.name };
      });
    });

    // 使用 Promise.any 竞速
    return Promise.any(promises).then(function (result) {
      var url = result.url;
      var name = result.name;
      cacheSet(cacheKey, url);
      var totalMs = Date.now() - startTime;
      sendLog(platform, name, totalMs);
      return url;
    }).catch(function (e) {
      if (e && e.errors) {
        e.errors.forEach(function (err) { errors.push(err.message); });
      } else if (e) {
        errors.push(e.message || String(e));
      }
      return null; // 全部失败，进入 Phase 2
    });
  }

  // Phase 2: 顺序尝试剩余源（kg平台已全部并发，无剩余）
  function phase2() {
    var offset = (platform === 'kg') ? chain.length : Math.min(3, chain.length);
    var remaining = chain.slice(offset);
    if (!remaining.length) return Promise.reject(new Error('所有音源均失败: ' + errors.join('; ')));

    function tryNext(index) {
      if (index >= remaining.length) {
        return Promise.reject(new Error('所有音源均失败: ' + errors.join('; ')));
      }
      var handler = remaining[index];
      return handler.fn(songInfo, quality).then(function (url) {
        var validUrl = validateUrl(url, handler.name);
        return deepValidateUrl(validUrl, handler.name);
      }).then(function (url) {
        cacheSet(cacheKey, url);
        var totalMs = Date.now() - startTime;
        sendLog(platform, handler.name, totalMs);
        return url;
      }).catch(function (e) {
        errors.push(handler.name + ': ' + (e.message || String(e)));
        return tryNext(index + 1);
      });
    }

    return tryNext(0);
  }

  return phase1().then(function (url) {
    if (url) return url;
    return phase2();
  });
}

// ==================== 更新检查 ====================

function checkUpdate() {
  if (!VERSION_CHECK_URL) return;
  httpGet(VERSION_CHECK_URL, {}, {}, 8000).then(function (body) {
    var remoteVersion = body && body.version;
    var localVersion = currentScriptInfo.version || '1.0.0';
    if (remoteVersion && remoteVersion !== localVersion) {
      var log = body.log || ('新版本 ' + remoteVersion + ' 可用，请更新音源脚本');
      var updateUrl = body.updateUrl || '';
      var alertData = { log: log.substring(0, 1024) };
      if (updateUrl) alertData.updateUrl = updateUrl.substring(0, 1024);
      send(EVENT_NAMES.updateAlert, alertData);
    }
  }).catch(function () {
    // 更新检查失败，静默处理
  });
}

// ==================== 事件注册与初始化 ====================

// 监听 request 事件
on(EVENT_NAMES.request, function (handler) {
  return new Promise(function (resolve, reject) {
    var action = handler.action;
    var source = handler.source;
    var info = handler.info;

    // 仅处理 musicUrl action（符合 LX Music 官方规范）
    if (action !== 'musicUrl') {
      return reject(new Error('action not support'));
    }

    if (!info || !info.musicInfo) {
      return reject(new Error('请求参数不完整'));
    }

    var quality = info.type || '128k';

    getUrlWithFallback(source, info.musicInfo, quality)
      .then(function (url) { resolve(url); })
      .catch(function (err) { reject(err); });
  });
});

// 构建音源配置（严格符合官方规范）
var sourceConfig = {};

Object.keys(PLATFORM_QUALITIES).forEach(function (platform) {
  sourceConfig[platform] = {
    name: PLATFORM_NAMES[platform],
    type: 'music',
    actions: ['musicUrl'],
    qualitys: PLATFORM_QUALITIES[platform]
  };
});

// 发送初始化事件
send(EVENT_NAMES.inited, {
  sources: sourceConfig
});

// 启动更新检查（延迟以避免阻塞初始化）
setTimeout(function () {
  checkUpdate();
}, 3000);

console.log('[西瓜聚合源] v1.40 已就绪 - 聚合星海/溯音/CHKSZ/长青/念心/Huibq/HYW/fish/收集/汽水VIP 共10+后端，覆盖wy/tx/kw/kg/mg五大平台');
