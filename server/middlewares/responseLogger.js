const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '../logs');
const MAX_LOG_SIZE = 10 * 1024 * 1024;
const LOG_FILE = path.join(LOG_DIR, `api-${new Date().toISOString().split('T')[0]}.log`);

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function formatLog(type, data) {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${type}] ${JSON.stringify(data, null, 2)}\n`;
}

function writeLog(type, data) {
  try {
    ensureLogDir();
    const logEntry = formatLog(type, data);
    
    if (fs.existsSync(LOG_FILE)) {
      const stats = fs.statSync(LOG_FILE);
      if (stats.size > MAX_LOG_SIZE) {
        const backup = LOG_FILE + '.old';
        if (fs.existsSync(backup)) fs.unlinkSync(backup);
        fs.renameSync(LOG_FILE, backup);
      }
    }
    
    fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
  } catch (e) {
    console.error('[Logger] 写入日志失败:', e.message);
  }
}

function responseLogger(req, res, next) {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const startTime = Date.now();
  
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    headers: {
      'content-type': req.header('content-type'),
      'authorization': req.header('authorization') ? '[已设置]' : '[未设置]'
    },
    requestBody: req.method !== 'GET' ? req.body : undefined,
    query: req.method === 'GET' ? req.query : undefined,
    params: req.params
  };

  res.json = function(data) {
    const duration = Date.now() - startTime;
    logData.statusCode = res.statusCode;
    logData.duration = duration + 'ms';
    logData.responseData = data;
    
    console.log('\n========== API 响应 ==========');
    console.log(`${logData.method} ${logData.url} → ${logData.statusCode} (${logData.duration})`);
    console.log('请求体:', JSON.stringify(logData.requestBody || logData.query || {}, null, 2).substring(0, 500));
    console.log('响应数据:', JSON.stringify(data, null, 2).substring(0, 1000));
    console.log('==============================\n');
    
    writeLog('RESPONSE', logData);
    
    return originalJson(data);
  };

  res.send = function(data) {
    const duration = Date.now() - startTime;
    logData.statusCode = res.statusCode;
    logData.duration = duration + 'ms';
    
    let responseStr = typeof data === 'string' ? data : JSON.stringify(data);
    if (responseStr.length > 1000) responseStr = responseStr.substring(0, 1000) + '...[截断]';
    logData.responseData = responseStr;
    
    console.log('\n========== API 响应 ==========');
    console.log(`${logData.method} ${logData.url} → ${logData.statusCode} (${logData.duration})`);
    console.log('响应数据:', responseStr);
    console.log('==============================\n');
    
    writeLog('RESPONSE', logData);
    
    return originalSend(data);
  };

  next();
}

function debugLogger(label, data) {
  const entry = {
    label,
    timestamp: new Date().toISOString(),
    data
  };
  console.log(`[DEBUG] ${label}:`, JSON.stringify(data, null, 2));
  writeLog('DEBUG', entry);
}

function errorLogger(label, error) {
  const entry = {
    label,
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack
    }
  };
  console.error(`[ERROR] ${label}:`, error.message);
  if (error.stack) {
    console.error(error.stack);
  }
  writeLog('ERROR', entry);
}

module.exports = {
  responseLogger,
  debugLogger,
  errorLogger,
  writeLog,
  LOG_DIR
};