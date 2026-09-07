/*!
 * @name 幻音音源
 * @version v3
 * @author 竹佀
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx

const cache = new Map()

on(EVENT_NAMES.request, ({ source, action, info }) => {
  if (action === 'musicUrl') {
    return getMusicUrl(source, info)
  }
  
  if (action === 'search' && source === 'mg') {
    return searchMiguMusic(info)
  }
  
  return Promise.reject(new Error('不支持'))
})

async function getMusicUrl(source, info) {
  const quality = info.type || '128k'
  const musicInfo = info.musicInfo
  
  try {
    if (source === 'mg') {
      return await getMiguUrl(musicInfo)
    }
    
    const platformMap = {
      'tx': 'qq',
      'kw': 'kuwo', 
      'wy': 'netease'
    }
    
    const platform = platformMap[source]
    if (!platform) {
      throw new Error(`不支持`)
    }
    
    const songId = musicInfo.songmid || musicInfo.id || musicInfo.mid
    if (!songId) {
      throw new Error('没ID')
    }
    
    const qualityMap = {
      '128k': '128k',
      '320k': '320k',
      'flac': 'flac',
      'flac24bit': 'flac24bit'
    }
    
    const br = qualityMap[quality] || '128k'
    return `https://music-dl.sayqz.com/api/?source=${platform}&id=${songId}&type=url&br=${br}`
    
  } catch (err) {
    console.error(`[幻音] 出错:`, err.message)
    throw new Error(`${err.message}`)
  }
}

async function getMiguUrl(musicInfo) {
  if (!musicInfo.name) {
    throw new Error('要歌名')
  }
  
  const cacheKey = `${musicInfo.name}|${musicInfo.albumName || musicInfo.album || ''}|${musicInfo.singer || ''}`
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }
  
  const songName = musicInfo.name
  const singer = musicInfo.singer || ''
  const album = musicInfo.albumName || musicInfo.album || ''
  
  // 先按优先级匹配
  const matches = []
  
  // 1. 歌名+专辑名
  if (album) {
    matches.push({
      keyword: clean(songName + album),
      strict: true
    })
  }
  
  // 2. 歌名+歌手
  if (singer) {
    matches.push({
      keyword: clean(songName + singer),
      strict: true
    })
  }
  
  // 3. 仅歌名
  matches.push({
    keyword: clean(songName),
    strict: false
  })
  
  for (const match of matches) {
    try {
      const url = await fetchMiguUrl(match.keyword, match.strict ? musicInfo : null)
      if (url) {
        cache.set(cacheKey, url)
        return url
      }
    } catch (e) {
      // 继续下一个
    }
  }
  
  throw new Error('咪咕找不到')
}

async function fetchMiguUrl(keyword, checkInfo) {
  const encoded = encodeURIComponent(keyword)
  const url = `https://api.xcvts.cn/api/music/migu?gm=${encoded}&n=1&num=1&type=json`
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('超时'))
    }, 3000)
    
    request(url, { method: 'GET', timeout: 3000 }, (err, resp) => {
      clearTimeout(timeout)
      
      if (err) {
        reject(new Error('网络问题'))
        return
      }
      
      try {
        const text = resp.body
        const data = typeof text === 'string' ? JSON.parse(text) : text
        
        if (data.code === 200 && data.music_url) {
          // 需要检查信息
          if (checkInfo) {
            if (checkMatch(data, checkInfo)) {
              resolve(data.music_url)
            } else {
              reject(new Error('信息不对'))
            }
          } else {
            // 不需要检查，直接返回
            resolve(data.music_url)
          }
        } else {
          reject(new Error('没链接'))
        }
      } catch (e) {
        reject(new Error('解析出错'))
      }
    })
  })
}

function checkMatch(apiData, musicInfo) {
  const apiTitle = (apiData.title || '').toLowerCase()
  const apiArtist = (apiData.artist || '').toLowerCase()
  const apiAlbum = (apiData.album || '').toLowerCase()
  
  const songName = (musicInfo.name || '').toLowerCase()
  const singer = (musicInfo.singer || '').toLowerCase()
  const album = ((musicInfo.albumName || musicInfo.album) || '').toLowerCase()
  
  // 歌名要对
  if (!apiTitle.includes(songName) && !songName.includes(apiTitle)) {
    return false
  }
  
  // 专辑要对（如果有）
  if (album && apiAlbum && !apiAlbum.includes(album) && !album.includes(apiAlbum)) {
    return false
  }
  
  // 歌手要对（如果有）
  if (singer && apiArtist && !apiArtist.includes(singer) && !singer.includes(apiArtist)) {
    return false
  }
  
  return true
}

async function searchMiguMusic(info) {
  const keyword = info.keyword
  if (!keyword) {
    throw new Error('没关键词')
  }
  
  const page = info.page || 1
  const limit = Math.min(info.limit || 10, 20)
  
  const results = []
  const searchKeyword = keyword.trim()
  
  // 最多试3页
  for (let i = 1; i <= 3 && results.length < limit; i++) {
    try {
      const song = await searchMigu(searchKeyword, i)
      if (song) {
        results.push(song)
      }
    } catch (e) {
      // 这页出问题就跳过
    }
    
    // 稍微停一下
    if (i < 3) {
      await sleep(100)
    }
  }
  
  if (results.length === 0) {
    throw new Error('没找到')
  }
  
  return results
}

async function searchMigu(keyword, page) {
  const encoded = encodeURIComponent(keyword)
  const url = `https://api.xcvts.cn/api/music/migu?gm=${encoded}&n=${page}&num=1&type=json`
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('超时'))
    }, 2000)
    
    request(url, { method: 'GET', timeout: 2000 }, (err, resp) => {
      clearTimeout(timeout)
      
      if (err) {
        reject(new Error('网络问题'))
        return
      }
      
      try {
        const text = resp.body
        const data = typeof text === 'string' ? JSON.parse(text) : text
        
        if (data.code === 200) {
          const song = {
            name: data.title || keyword,
            singer: data.artist || '',
            albumName: data.album || '',
            id: `mg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            source: 'mg',
            interval: data.duration || '00:00'
          }
          resolve(song)
        } else {
          reject(new Error('没搜到'))
        }
      } catch (e) {
        reject(new Error('解析出错'))
      }
    })
  })
}

function clean(text) {
  if (!text) return ''
  return text
    .replace(/\(\s*Live\s*\)/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, '')
    .trim()
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

send(EVENT_NAMES.inited, {
  openDevTools: false,
  sources: {
    tx: {
      name: 'QQ音乐',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k', '320k', 'flac', 'flac24bit']
    },
    kw: {
      name: '酷我音乐',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k', '320k', 'flac', 'flac24bit']
    },
    wy: {
      name: '网易云音乐',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: ['128k', '320k', 'flac', 'flac24bit']
    },
    mg: {
      name: '咪咕音乐',
      type: 'music',
      actions: ['musicUrl', 'search'],
      qualitys: ['128k', '320k'],
      supportSearchSuggestions: false
    }
  }
})

console.log('[幻音音源] 就绪')