const { onRequest } = require('firebase-functions/v2/https');
  const server = import('firebase-frameworks');
  exports.ssrtravelagentasoka = onRequest({"region":"asia-east1","cpu":1,"memoryMiB":1024,"minInstances":0}, (req, res) => server.then(it => it.handle(req, res)));
  