function logger(req, res, next) {
  const startTime = Date.now();
  const { method, path, ip } = req;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`[${new Date().toISOString()}] ${method} ${path} ${res.statusCode} ${duration}ms - ${ip}`);
  });
  
  next();
}

module.exports = logger;