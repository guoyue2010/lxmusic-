/**
 * @name 稳定版音源 v1.0.3
 * @description 多平台稳定获取播放链接，无调试日志
 * @version 1.0.3
 * @author LX
 * @homepage https://lxmusic.toside.cn/mobile/custom-source
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx;

const QUALITY_MAP = {
    wy: { '128k': 'standard', '320k': 'exhigh', 'flac': 'lossless', 'flac24bit': 'lossless' },
    tx: { '128k': '128k', '320k': '320k', 'flac': 'flac', 'flac24bit': 'flac' },
    kw: { '128k': '128k', '320k': '320k', 'flac': 'lossless', 'flac24bit': 'lossless' }
};

const STABLE_API = {
    wy: (id, level) => `https://api.injahow.cn/meting/api/?server=wy&type=url&id=${id}&level=${level}`,
    tx: (id, level) => `https://cyapi.top/API/qq_music.php?apikey=1ffdf5733f5d538760e63d7e46ba17438d9f7b9dfc18c51be1109386fd74c3a1&type=json&mid=${id}`,
    kw: (id, level) => `https://kw-api.cenguigui.cn?id=${id}&type=song&format=json&level=${level}`
};

const httpRequest = (url, options = { method: 'GET' }) => new Promise((resolve, reject) => {
    request(url, options, (err, _, body) => {
        if (err) return reject(err);
        resolve(body);
    });
});

const getMusicUrl = async (source, musicInfo, quality) => {
    const songId = (
        musicInfo.id ||
        musicInfo.hash ||
        musicInfo.songmid ||
        musicInfo.songId ||
        musicInfo.musicId ||
        ''
    ).toString().trim();

    if (!songId) throw new Error('歌曲ID无效，请检查歌单导入来源');

    const level = QUALITY_MAP[source][quality] || '128k';
    const apiUrl = STABLE_API[source](songId, level);

    const res = await httpRequest(apiUrl, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
        }
    });

    let realUrl = '';
    if (typeof res === 'string') {
        realUrl = res;
    } else if (res?.url) {
        realUrl = res.url;
    } else if (res?.data?.url) {
        realUrl = res.data.url;
    }

    if (!realUrl || realUrl.includes('404') || realUrl.includes('error') || realUrl.includes('null')) {
        throw new Error('获取链接失败，可能是该歌曲无版权或接口维护');
    }
    return realUrl;
};

const apis = {
    wy: { musicUrl: (info, q) => getMusicUrl('wy', info, q) },
    tx: { musicUrl: (info, q) => getMusicUrl('tx', info, q) },
    kw: { musicUrl: (info, q) => getMusicUrl('kw', info, q) }
};

on(EVENT_NAMES.request, (params) => {
    const { source, action, info } = params;
    switch (action) {
        case 'musicUrl':
            return apis[source].musicUrl(info.musicInfo, info.type)
                .catch(err => Promise.reject(err.message || '获取播放链接失败'));
        default:
            return Promise.reject('不支持的操作，仅支持musicUrl');
    }
});

send(EVENT_NAMES.inited, {
    sources: {
        wy: { name: '网易云稳定版', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac', 'flac24bit'] },
        tx: { name: 'QQ音乐稳定版', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac', 'flac24bit'] },
        kw: { name: '酷狗稳定版', type: 'music', actions: ['musicUrl'], qualitys: ['128k', '320k', 'flac', 'flac24bit'] }
    }
});
