/**
 * @name gdstudio音乐源
 * @description 通过 music-api.gdstudio.xyz 提供音乐播放链接
 * @version 1.0.1
 * @author lx-music
 * @homepage https://github.com/lyswhut/lx-music-desktop
 */

/* =========================== 配置 =========================== */
var DEV_ENABLE = false
var API_BASE = 'https://music-api.gdstudio.xyz/api.php'
var SEARCH_COUNT = 5
var CACHE_TTL = 30 * 60 * 1000
var REQUEST_TIMEOUT = 15000

/* ======================= 音质映射 =========================== */
var QUALITY_MAP = {
  '128k': 128,
  '320k': 320,
  flac: 740,
  flac24bit: 999,
}
var QUALITY_FALLBACKS = {
  999: [740, 320, 128],
  740: [320, 128],
  320: [128],
  128: [],
}

/* ======================= 音源映射 =========================== */
var SOURCE_MAP = {
  wy: 'netease',
  kw: 'kuwo',
  tx: 'tencent',
  kg: 'netease',
  mg: 'netease',
}

var SUPPORTED_SOURCES = ['wy', 'kw', 'tx', 'kg', 'mg']
var MUSIC_QUALITY = {
  wy: ['128k', '320k', 'flac', 'flac24bit'],
  kw: ['128k', '320k', 'flac', 'flac24bit'],
  tx: ['128k', '320k', 'flac', 'flac24bit'],
  kg: ['128k', '320k', 'flac', 'flac24bit'],
  mg: ['128k', '320k', 'flac', 'flac24bit'],
}

/* ===================== LX 环境变量 ========================== */
var EVENT_NAMES = globalThis.lx.EVENT_NAMES
var request = globalThis.lx.request
var on = globalThis.lx.on
var send = globalThis.lx.send
var env = globalThis.lx.env
var version = globalThis.lx.version

/* ======================= 工具函数 =========================== */

var httpFetch = function (url, options) {
  options = options || { method: 'GET' }
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(function () {
      reject(new Error('Request timeout'))
    }, REQUEST_TIMEOUT)
    request(url, options, function (err, resp) {
      clearTimeout(timer)
      if (err) return reject(err)
      resolve(resp)
    })
  })
}

var buildSearchUrl = function (source, keyword) {
  return API_BASE + '?types=search&source=' + source + '&name=' + encodeURIComponent(keyword) + '&count=' + SEARCH_COUNT
}

var buildUrlApi = function (source, trackId, br) {
  return API_BASE + '?types=url&source=' + source + '&id=' + trackId + '&br=' + br
}

/* ======================= 歌手名拆分 ========================= */

// 分隔符：、 & ; / , | （半角和全角）
var SINGER_SPLIT_RXP = /、|&|;|；|\/|,|，|\|/

// 将 artist 字段转为字符串（gdstudio 返回的是数组）
var normalizeArtist = function (artist) {
  if (!artist) return ''
  if (Array.isArray(artist)) {
    // 清理每个歌手名末尾的 - . 等符号，再拼接
    var cleaned = artist.map(function (a) {
      return String(a).replace(/[-.]+$/g, '').trim()
    })
    return cleaned.join('、')
  }
  return String(artist)
}

var getFirstSinger = function (artist) {
  if (!artist) return ''
  var str = normalizeArtist(artist)
  return str.split(SINGER_SPLIT_RXP)[0].toLowerCase()
}

/* ======================= 相似度匹配 ========================= */

var calcSimilarity = function (a, b) {
  if (!a || !b) return 0
  var sa = a.toLowerCase().replace(/\s+/g, '')
  var sb = b.toLowerCase().replace(/\s+/g, '')
  if (sa === sb) return 100
  if (sa.includes(sb) || sb.includes(sa)) return 80
  var minLen = Math.min(sa.length, sb.length)
  var match = 0
  for (var i = 0; i < minLen; i++) {
    if (sa[i] === sb[i]) match++
    else break
  }
  return (match / Math.max(sa.length, sb.length)) * 60
}

var selectBestMatch = function (list, targetName, targetSinger) {
  if (!list || !list.length) return null
  if (list.length === 1) return list[0]

  var tName = (targetName || '').toLowerCase().trim()
  var tSinger = getFirstSinger(targetSinger)

  var scored = list.map(function (item) {
    var iName = (item.name || '').toLowerCase().trim()
    var iArtistStr = normalizeArtist(item.artist).toLowerCase()
    var iArtistFirst = getFirstSinger(item.artist)

    var score = 0
    if (iName === tName) {
      score += 50
    } else if (iName.includes(tName) || tName.includes(iName)) {
      score += 35
    } else {
      score += calcSimilarity(tName, iName) * 0.3
    }

    if (tSinger && (iArtistStr.indexOf(tSinger) >= 0 || iArtistFirst === tSinger)) {
      score += 40
    } else if (tSinger) {
      score += calcSimilarity(tSinger, iArtistFirst) * 0.2
    }

    return { item: item, score: score }
  })

  scored.sort(function (a, b) { return b.score - a.score })
  if (scored[0].score < 20) return null
  return scored[0].item
}

/* ======================= 缓存系统 =========================== */

var pendingCache = {}
var resultCache = {}

var makeCacheKey = function (lxSource, name, singer) {
  var sname = (name || '').toLowerCase().replace(/\s+/g, '')
  var ssinger = getFirstSinger(singer || '')
  return lxSource + ':' + sname + ':' + ssinger
}

var cacheGet = function (key) {
  var entry = resultCache[key]
  if (!entry) return null
  if (Date.now() > entry.expireTime) {
    delete resultCache[key]
    return null
  }
  return entry.data
}

var cacheSet = function (key, data) {
  var keys = Object.keys(resultCache)
  if (keys.length > 500) {
    delete resultCache[keys[0]]
  }
  resultCache[key] = {
    data: data,
    expireTime: Date.now() + CACHE_TTL,
  }
}

/* ====================== API 封装 =========================== */

var searchSong = async function (lxSource, targetSource, name, singer) {
  var cacheKey = makeCacheKey(lxSource, name, singer)

  var cached = cacheGet(cacheKey)
  if (cached) return cached

  if (pendingCache[cacheKey]) return pendingCache[cacheKey]

  var keyword = (name || '') + ' ' + (singer || '')
  keyword = keyword.trim()
  if (!keyword) throw new Error('Search keyword is empty')

  var promise = (async function () {
    try {
      var resp = await httpFetch(buildSearchUrl(targetSource, keyword))
      var body = resp.body
      if (!body || !Array.isArray(body)) {
        throw new Error('Invalid search response')
      }
      if (!body.length) {
        throw new Error('No search results')
      }

      var matched = selectBestMatch(body, name, singer)
      if (!matched) {
        throw new Error('No matching song found')
      }

      var result = {
        trackId: matched.id,
        lyricId: matched.lyric_id || matched.id,
        picId: matched.pic_id || '',
        matchedName: matched.name,
        matchedArtist: matched.artist,
        gdSource: matched.source || targetSource,
      }
      cacheSet(cacheKey, result)
      return result
    } finally {
      delete pendingCache[cacheKey]
    }
  })()

  pendingCache[cacheKey] = promise
  return promise
}

/* ====================== Action 处理 ========================= */

var handleMusicUrl = async function (lxSource, musicInfo, quality) {
  var targetSource = SOURCE_MAP[lxSource]
  if (!targetSource) throw new Error('Unsupported source: ' + lxSource)

  var requestedBr = QUALITY_MAP[quality] || 320
  var fallbacks = QUALITY_FALLBACKS[requestedBr] || [320, 128]
  var brsToTry = [requestedBr].concat(fallbacks)

  var searchResult = await searchSong(lxSource, targetSource, musicInfo.name, musicInfo.singer)

  for (var i = 0; i < brsToTry.length; i++) {
    var br = brsToTry[i]
    try {
      var resp = await httpFetch(buildUrlApi(searchResult.gdSource, searchResult.trackId, br))
      var body = resp.body
      if (body && body.url) {
        if (br !== requestedBr) {
          console.log('[gdstudio] quality fallback: ' + quality + '(' + requestedBr + ') -> br=' + br)
        }
        return body.url
      }
    } catch (_) {}
  }

  throw new Error('Failed to get audio URL at all quality levels')
}

/* ====================== 事件注册 =========================== */

on(EVENT_NAMES.request, function (data) {
  var action = data.action
  var source = data.source
  var info = data.info

  switch (action) {
    case 'musicUrl':
      if (env !== 'mobile') {
        console.group('[gdstudio] musicUrl')
        console.log('source:', source)
        console.log('quality:', info.type)
        console.log('name:', info.musicInfo && info.musicInfo.name)
        console.log('singer:', info.musicInfo && info.musicInfo.singer)
        console.groupEnd()
      }
      return handleMusicUrl(source, info.musicInfo, info.type)
    default:
      return Promise.reject(new Error('Unsupported action: ' + action))
  }
})

/* ====================== 初始化 =========================== */

var musicSources = {}
SUPPORTED_SOURCES.forEach(function (s) {
  musicSources[s] = {
    name: s,
    type: 'music',
    actions: ['musicUrl'],
    qualitys: MUSIC_QUALITY[s],
  }
})

send(EVENT_NAMES.inited, {
  openDevTools: DEV_ENABLE,
  sources: musicSources,
})
