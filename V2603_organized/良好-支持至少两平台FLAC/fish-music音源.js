/*!
 * @name fish_music
 * @description 交流群组:https://t.me/yus_share
 * @version 1.0.1
 * @author 大鱼吃小鱼
 * @repository https://github.com/lxmusics/lx-music-api-server
 */

// 是否开启开发模式
const DEV_ENABLE = false
// 是否开启更新提醒
const UPDATE_ENABLE = true
// 服务端地址
const API_URL = "https://m-api.ceseet.me"
// 服务端配置的请求key
const API_KEY = ``
// 音质配置(key为音源名称,不要乱填.如果你账号为VIP可以填写到hires)
// 全部的支持值: ['128k', '320k', 'flac', 'flac24bit']
const MUSIC_QUALITY = JSON.parse('{"kw":["128k","320k","flac","flac24bit"],"kg":["128k","320k","flac","flac24bit"],"tx":["128k","320k","flac","flac24bit"],"wy":["128k","320k","flac"],"mg":["128k","320k","flac","flac24bit"]}')
// 音源配置(默认为自动生成,可以修改为手动)
const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)
MUSIC_SOURCE.push('local')

/**
 * 下面的东西就不要修改了
 */
const { EVENT_NAMES, request, on, send, utils, env, version } = globalThis.lx

// MD5值,用来检查更新
const SCRIPT_MD5 = '5fe365644241ca1b6a0f7ae4e333cf52'

/**
 * URL请求
 *
 * @param {string} url - 请求的地址
 * @param {object} options - 请求的配置文件
 * @return {Promise} 携带响应体的Promise对象
 */
const httpFetch = (url, options = { method: 'GET' }) => {
  return new Promise((resolve, reject) => {
    console.log('--- start --- ' + url)
    request(url, options, (err, resp) => {
      if (err) return reject(err)
      console.log('API Response: ', resp)
      resolve(resp)
    })
  })
}

/**
 * Encodes the given data to base64.
 *
 * @param {type} data - the data to be encoded
 * @return {string} the base64 encoded string
 */
const handleBase64Encode = (data) => {
  var data = utils.buffer.from(data, 'utf-8')
  return utils.buffer.bufToString(data, 'base64')
}

/**
 * 
 * @param {string} source - 音源
 * @param {object} musicInfo - 歌曲信息
 * @param {string} quality - 音质
 * @returns {Promise<string>} 歌曲播放链接
 * @throws {Error} - 错误消息
 */
const handleGetMusicUrl = async (source, musicInfo, quality) => {
  if (source == 'local') {
    if (!musicInfo.songmid.startsWith('server_')) throw new Error('upsupported local file')
    const songId = musicInfo.songmid
    const requestBody = {
      p: songId.replace('server_', ''),
    }
    var t = 'c'
    var b = handleBase64Encode(JSON.stringify(requestBody)) /* url safe*/.replace(/\+/g, '-').replace(/\//g, '_')
    const targetUrl = `${API_URL}/local/${t}?q=${b}`
    const request = await httpFetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`,
        'X-Request-Key': API_KEY,
      },
      follow_max: 5,
    })
    const { body } = request
    if (body.code == 0 && body.data && body.data.file) {
      var t = 'u'
      var b = handleBase64Encode(JSON.stringify(requestBody)) /* url safe*/.replace(/\+/g, '-').replace(/\//g, '_')
      return `${API_URL}/local/${t}?q=${b}`
    }
    throw new Error('404 Not Found')
  }

  const songId = musicInfo.hash ?? musicInfo.songmid

  const request = await httpFetch(`${API_URL}/url/${encodeURIComponent(source)}/${encodeURIComponent(songId)}/${encodeURIComponent(quality)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`,
      'X-Request-Key': API_KEY,
    },
    follow_max: 5,
  })
  const { body } = request

  if (!body || isNaN(Number(body.code))) throw new Error('unknow error')
  if (env != 'mobile') console.groupEnd()
  switch (body.code) {
    case 0:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) success, URL: ${body.data}`)
      return body.data
    case 1:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed: ip被封禁`)
      throw new Error('block ip')
    case 2:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, ${body.msg}`)
      throw new Error('get music url failed')
    case 4:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, 远程服务器错误`)
      throw new Error('internal server error')
    case 5:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, 请求过于频繁，请休息一下吧`)
      throw new Error('too many requests')
    case 6:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, 请求参数错误`)
      throw new Error('param error')
    default:
      console.log(`handleGetMusicUrl(${source}_${musicInfo.songmid}, ${quality}) failed, ${body.msg ? body.msg : 'unknow error'}`)
      throw new Error(body.msg ?? 'unknow error')
  }
}

const handleGetMusicPic = async (source, musicInfo) => {
  switch (source) {
    case 'local':
      // 先从服务器检查是否有对应的类型，再响应链接
      if (!musicInfo.songmid.startsWith('server_')) throw new Error('upsupported local file')
      const songId = musicInfo.songmid
      const requestBody = {
        p: songId.replace('server_', ''),
      }
      var t = 'c'
      var b = handleBase64Encode(JSON.stringify(requestBody))/* url safe*/.replace(/\+/g, '-').replace(/\//g, '_')
      const targetUrl = `${API_URL}/local/${t}?q=${b}`
      const request = await httpFetch(targetUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`
        },
        follow_max: 5,
      })
      const { body } = request
      if (body.code === 0 && body.data.cover) {
        var t = 'p'
        var b = handleBase64Encode(JSON.stringify(requestBody))/* url safe*/.replace(/\+/g, '-').replace(/\//g, '_')
        return `${API_URL}/local/${t}?q=${b}`
      }
      throw new Error('get music pic failed')
    default:
      throw new Error('action(pic) does not support source(' + source + ')')
  }
}

const handleGetMusicLyric = async (source, musicInfo) => {
  switch (source) {
    case 'local':
      if (!musicInfo.songmid.startsWith('server_')) throw new Error('upsupported local file')
      const songId = musicInfo.songmid
      const requestBody = {
        p: songId.replace('server_', ''),
      }
      var t = 'c'
      var b = handleBase64Encode(JSON.stringify(requestBody))/* url safe*/.replace(/\+/g, '-').replace(/\//g, '_')
      const targetUrl = `${API_URL}/local/${t}?q=${b}`
      const request = await httpFetch(targetUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`
        },
        follow_max: 5,
      })
      const { body } = request
      if (body.code === 0 && body.data.lyric) {
        var t = 'l'
        var b = handleBase64Encode(JSON.stringify(requestBody))/* url safe*/.replace(/\+/g, '-').replace(/\//g, '_')
        const request2 = await httpFetch(`${API_URL}/local/${t}?q=${b}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`
          },
          follow_max: 5,
        })
        if (request2.body.code === 0) {
          return {
            lyric: request2.body.data ?? "",
            tlyric: "",
            rlyric: "",
            lxlyric: ""
          }
        }
        throw new Error('get music lyric failed')
      }
      throw new Error('get music lyric failed')
    default:
      throw new Error('action(lyric) does not support source(' + source + ')')
  }
}

// 检查源脚本是否有更新
const checkUpdate = async () => {
  const request = await httpFetch(`${API_URL}/script?key=${API_KEY}&checkUpdate=${SCRIPT_MD5}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': `${env ? `lx-music-${env}/${version}` : `lx-music-request/${version}`}`
    },
  })
  const { body } = request

  if (!body || body.code !== 0) console.log('checkUpdate failed')
  else {
    console.log('checkUpdate success')
    if (body.data != null) {
      globalThis.lx.send(lx.EVENT_NAMES.updateAlert, { log: body.data.updateMsg, updateUrl: body.data.updateUrl })
    }
  }
}

// 生成歌曲信息
const musicSources = {}
MUSIC_SOURCE.forEach(item => {
  musicSources[item] = {
    name: item,
    type: 'music',
    actions: (item == 'local') ? ['musicUrl', 'pic', 'lyric'] : ['musicUrl'],
    qualitys: (item == 'local') ? [] : MUSIC_QUALITY[item],
  }
})

// 监听 LX Music 请求事件
on(EVENT_NAMES.request, ({ action, source, info }) => {
  switch (action) {
    case 'musicUrl':
      if (env != 'mobile') {
        console.group(`Handle Action(musicUrl)`)
        console.log('source', source)
        console.log('quality', info.type)
        console.log('musicInfo', info.musicInfo)
      } else {
        console.log(`Handle Action(musicUrl)`)
        console.log('source', source)
        console.log('quality', info.type)
        console.log('musicInfo', info.musicInfo)
      }
      return handleGetMusicUrl(source, info.musicInfo, info.type)
        .then(data => Promise.resolve(data))
        .catch(err => Promise.reject(err))
    case 'pic':
      return handleGetMusicPic(source, info.musicInfo)
        .then(data => Promise.resolve(data))
        .catch(err => Promise.reject(err))
    case 'lyric':
      return handleGetMusicLyric(source, info.musicInfo)
        .then(data => Promise.resolve(data))
        .catch(err => Promise.reject(err))
    default:
      console.error(`action(${action}) not support`)
      return Promise.reject('action not support')
  }
})

// 检查更新
if (UPDATE_ENABLE) checkUpdate()
// 向 LX Music 发送初始化成功事件
send(EVENT_NAMES.inited, { status: true, openDevTools: DEV_ENABLE, sources: musicSources })
