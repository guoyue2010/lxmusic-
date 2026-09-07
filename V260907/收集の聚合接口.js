/*!
 * @name 收集の聚合接口(LX版)
 * @id netapis_free
 * @version 1.0.0-beta
 * @description 聚合接口-来源于网络 整理:QZ
 * @author QZ
 * @support tx wy kw
 * @expire 2099-12-31 23:59:59
 */

const DEV_ENABLE = false
const UPDATE_ENABLE = false                                    // 本接口无更新检查
const SUPPORT_SOURCE = ['tx', 'wy', 'kw']
const QUALITY_MAP = {                                          // 落雪音质 -> 自身音质
  tx: { '128k': '128k', '320k': '320k', 'flac': 'flac', 'flac24bit': 'flac', 'hires': 'flac', 'atmos': 'flac', 'master': 'flac' },
  wy: { '128k': 'standard', '320k': 'exhigh', 'flac': 'lossless', 'flac24bit': 'lossless', 'hires': 'lossless', 'atmos': 'lossless', 'master': 'lossless' },
  kw: { '128k': '128k', '320k': '320k', 'flac': 'lossless', 'flac24bit': 'lossless', 'hires': 'lossless', 'atmos': 'lossless', 'master': 'lossless' }
}

const { EVENT_NAMES, request, on, send, env, version } = globalThis.lx

/* ---------- 工具 ---------- */
const httpFetch = (url, options = { method: 'GET' }) => {
  return new Promise((resolve, reject) => {
    request(url, options, (err, resp) => {
      if (err) return reject(err)
      resolve(resp)
    })
  })
}

/* ---------- 核心 ---------- */
const getMusicUrl = async (source, musicInfo, quality) => {
  const songId = musicInfo.hash ?? musicInfo.songmid
  const level = QUALITY_MAP[source][quality] || 'lossless'

  let url
  switch (source) {
    case 'tx':
      url = `https://cyapi.top/API/qq_music.php?apikey=1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1&type=json&mid=${songId}`
      break
    case 'wy':
      url = `https://api.cenguigui.cn/api/netease/music_v1.php?id=${songId}&type=json&level=${level}`
      break
    case 'kw':
      url = `https://kw-api.cenguigui.cn?id=${songId}&type=song&format=json&level=${level}`
      break
    default:
      throw new Error('不支持的源')
  }

  const { body } = await httpFetch(url, {
    method: 'GET',
    headers: { 'User-Agent': env ? `lx-music-${env}/${version}` : `lx-music-request/${version}` }
  })

  if (!body) throw new Error('空响应')

  // 统一提取 url
  let realUrl
  if (source === 'tx') realUrl = body.url
  else if (body.data) realUrl = body.data.url
  if (!realUrl) throw new Error('获取播放链接失败')

  return realUrl
}

/* ---------- 注册 ---------- */
const sources = {}
SUPPORT_SOURCE.forEach(s => {
  sources[s] = {
    name: s,
    type: 'music',
    actions: ['musicUrl'],
    qualitys: Object.keys(QUALITY_MAP[s])
  }
})

on(EVENT_NAMES.request, ({ action, source, info }) => {
  if (action !== 'musicUrl') return Promise.reject('action not support')
  return getMusicUrl(source, info.musicInfo, info.type)
    .then(url => Promise.resolve(url))
    .catch(err => Promise.reject(err.message || err))
})

send(EVENT_NAMES.inited, {
  status: true,
  openDevTools: DEV_ENABLE,
  sources
})