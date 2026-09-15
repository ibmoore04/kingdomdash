const http = require('http');

[5173, 5174, 5175].forEach(port => {
  http.get(`http://localhost:${port}`, res => {
    console.log(`Port ${port}: ${res.statusCode}`);
  }).on('error', err => {
    console.log(`Port ${port}: Error - ${err.message}`);
  });
});
