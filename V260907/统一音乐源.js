/**
 * @name 统一音乐源
 * @description 基于GD音乐台（music.gdstudio.xyz）的通用音乐源
 * @version 1.0.0
 * @author 脚本作者：7878gyc API提供者：GDSTUDIO
 */

console.log('脚本开始执行');

// 检查lx对象
if (typeof globalThis.lx === 'undefined') {
  console.log('错误: lx对象不存在');
} else {
  console.log('lx版本:', globalThis.lx.version);
  console.log('运行环境:', globalThis.lx.env);
  
  // 源映射
  var sourceMap = {
    'kw': 'kuwo',
    'wy': 'netease'
  };
  
  // 音质映射 - 添加flac支持
  var qualityMap = {
    '128k': '128',
    '192k': '192',
    '320k': '320',
    'flac': '740',     // 16bit flac
    'flac24bit': '999' // 24bit flac（酷我可能不支持，但先加上）
  };
  
  // 各源支持的音质
  var sourceQualitys = {
    'kw': ['128k', '192k', '320k', 'flac'], // 酷我支持16bit flac
    'wy': ['128k', '320k', 'flac']          // 网易云支持flac
  };
  
  // HTTP请求函数
  function httpRequest(url) {
    return new Promise(function(resolve, reject) {
      console.log('发送HTTP请求:', url);
      
      var options = {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        }
      };
      
      globalThis.lx.request(url, options, function(err, resp) {
        if (err) {
          console.log('HTTP请求错误:', err.message || err);
          reject(new Error('网络请求失败'));
          return;
        }
        
        console.log('HTTP响应状态码:', resp.statusCode);
        console.log('响应体类型:', typeof resp.body);
        
        // 记录响应头中的content-type
        if (resp.headers && resp.headers['content-type']) {
          console.log('Content-Type:', resp.headers['content-type']);
        }
        
        // 如果响应体是对象，直接记录
        if (resp.body && typeof resp.body === 'object') {
          console.log('响应体是对象，键:', Object.keys(resp.body));
          console.log('响应体内容:', JSON.stringify(resp.body).substring(0, 200));
        } else if (typeof resp.body === 'string') {
          console.log('响应体是字符串，长度:', resp.body.length);
          console.log('响应体前200字符:', resp.body.substring(0, Math.min(200, resp.body.length)));
        }
        
        resolve(resp);
      });
    });
  }
  
  // 从响应中提取URL
  function extractUrlFromResponse(resp) {
    if (!resp) {
      console.log('响应为空');
      return null;
    }
    
    var body = resp.body;
    console.log('提取URL，body类型:', typeof body);
    
    // 如果body已经是对象
    if (body && typeof body === 'object') {
      console.log('body是对象，直接提取URL');
      
      // 根据API文档，可能的返回格式：
      // 1. {url: "音乐链接", br: "音质", size: "文件大小"}
      // 2. {data: {url: "音乐链接", br: "音质", size: "文件大小"}}
      
      if (body.url) {
        console.log('从body.url获取URL');
        return body.url;
      }
      
      if (body.data && body.data.url) {
        console.log('从body.data.url获取URL');
        return body.data.url;
      }
      
      // 尝试查找任何包含URL的字段
      for (var key in body) {
        var value = body[key];
        if (typeof value === 'string' && value.startsWith('http')) {
          console.log('从字段', key, '获取URL');
          return value;
        }
        if (value && typeof value === 'object' && value.url && typeof value.url === 'string' && value.url.startsWith('http')) {
          console.log('从嵌套对象', key, '.url获取URL');
          return value.url;
        }
      }
      
      console.log('无法从对象中提取URL，对象内容:', JSON.stringify(body).substring(0, 300));
      return null;
    }
    
    // 如果body是字符串，尝试解析为JSON
    if (typeof body === 'string') {
      console.log('body是字符串，尝试解析为JSON');
      try {
        var data = JSON.parse(body);
        if (data.url) return data.url;
        if (data.data && data.data.url) return data.data.url;
      } catch (e) {
        console.log('JSON解析失败:', e.message);
      }
      
      // 如果不是JSON，尝试正则匹配URL
      var urlMatch = body.match(/https?:\/\/[^\s<>"']+/);
      if (urlMatch) {
        console.log('从字符串中正则匹配到URL');
        return urlMatch[0];
      }
    }
    
    console.log('无法提取URL');
    return null;
  }
  
  // 音质降级策略
  function getQualityFallbackChain(quality) {
    var chain = [];
    
    switch(quality) {
      case 'flac24bit':
        chain = ['flac24bit', 'flac', '320k', '192k', '128k'];
        break;
      case 'flac':
        chain = ['flac', '320k', '192k', '128k'];
        break;
      case '320k':
        chain = ['320k', '192k', '128k'];
        break;
      case '192k':
        chain = ['192k', '128k'];
        break;
      case '128k':
        chain = ['128k'];
        break;
      default:
        chain = ['320k', '128k'];
    }
    
    return chain;
  }
  
  // 获取音乐URL（支持音质降级）
  function getMusicUrl(musicInfo, quality) {
    console.log('开始获取音乐URL:', {
      source: musicInfo.source,
      songmid: musicInfo.songmid,
      id: musicInfo.id,
      quality: quality
    });
    
    return new Promise(function(resolve, reject) {
      try {
        var source = musicInfo.source;
        var apiSource = sourceMap[source];
        
        if (!apiSource) {
          console.log('不支持的音源:', source);
          reject(new Error('暂不支持此音源'));
          return;
        }
        
        var songId = musicInfo.songmid || musicInfo.id;
        if (!songId) {
          console.log('缺少歌曲ID');
          reject(new Error('缺少歌曲ID'));
          return;
        }
        
        // 获取该源支持的音质列表
        var supportedQualitys = sourceQualitys[source] || ['128k', '320k'];
        var qualityChain = getQualityFallbackChain(quality);
        
        // 过滤掉不支持的音质
        qualityChain = qualityChain.filter(function(q) {
          return supportedQualitys.includes(q);
        });
        
        console.log('音质尝试链:', qualityChain);
        
        // 递归尝试不同音质
        function tryQualityChain(index) {
          if (index >= qualityChain.length) {
            reject(new Error('所有音质尝试均失败'));
            return;
          }
          
          var currentQuality = qualityChain[index];
          var br = qualityMap[currentQuality] || '320';
          
          console.log('尝试音质:', currentQuality, '-> br:', br);
          
          var url = 'https://music-api.gdstudio.xyz/api.php?types=url&source=' + apiSource + '&id=' + songId + '&br=' + br;
          
          httpRequest(url).then(function(resp) {
            if (resp.statusCode !== 200) {
              console.log('音质', currentQuality, '请求失败，状态码:', resp.statusCode);
              tryQualityChain(index + 1);
              return;
            }
            
            var musicUrl = extractUrlFromResponse(resp);
            
            if (musicUrl) {
              console.log('成功获取', currentQuality, '音质URL');
              resolve(musicUrl);
            } else {
              console.log('音质', currentQuality, '无法提取URL');
              tryQualityChain(index + 1);
            }
          }).catch(function(err) {
            console.log('音质', currentQuality, '请求出错:', err.message);
            tryQualityChain(index + 1);
          });
        }
        
        // 开始尝试
        tryQualityChain(0);
        
      } catch (error) {
        console.log('获取音乐URL过程中发生异常:', error);
        reject(error);
      }
    });
  }
  
  // 注册事件处理器
  console.log('注册事件处理器');
  
  globalThis.lx.on(globalThis.lx.EVENT_NAMES.request, function(data) {
    console.log('收到请求事件, action:', data.action);
    
    if (data.action === 'musicUrl') {
      return getMusicUrl(data.info.musicInfo, data.info.type);
    }
    
    return Promise.reject(new Error('不支持的action: ' + data.action));
  });
  
  // 初始化
  console.log('准备初始化');
  
  setTimeout(function() {
    try {
      console.log('发送初始化事件');
      
      var config = {
        sources: {
          kw: {
            name: '酷我音乐',
            type: 'music',
            actions: ['musicUrl'],
            qualitys: ['128k', '192k', '320k', 'flac'] // 添加flac支持
          },
          wy: {
            name: '网易云音乐',
            type: 'music',
            actions: ['musicUrl'],
            qualitys: ['128k', '320k', 'flac'] // 添加flac支持
          }
        }
      };
      
      globalThis.lx.send(globalThis.lx.EVENT_NAMES.inited, config);
      console.log('初始化完成');
      
    } catch (error) {
      console.log('初始化失败:', error);
    }
  }, 100);
}

console.log('脚本加载完成');
