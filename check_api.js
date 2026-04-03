const http = require('http');
http.get('http://localhost:3000/api/review', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('criteriaLabels:', JSON.stringify(json.criteriaLabels, null, 2));
  });
}).on('error', e => console.error(e));
