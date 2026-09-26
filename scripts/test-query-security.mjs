import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import test from 'node:test';

const require = createRequire(new URL('../apps/backend/package.json', import.meta.url));
const express = require('express');
const bodyRequire = createRequire(require.resolve('body-parser'));
const consumers = [
  ['Express', createRequire(require.resolve('express'))('qs')],
  ['body-parser', bodyRequire('qs')],
];

for (const [name, qs] of consumers) {
  test(`${name}: bracketed comma arrays obey the configured array limit`, () => {
    assert.throws(() => qs.parse('items[]=a,b,c,d', {
      comma: true, arrayLimit: 3, throwOnLimitExceeded: true,
    }), RangeError);
  });

  test(`${name}: attacker-controlled isBuffer round trip remains data`, () => {
    const parsed = qs.parse('item[constructor][isBuffer]=true', { plainObjects: true });
    assert.equal(qs.stringify(parsed), 'item%5Bconstructor%5D%5BisBuffer%5D=true');
  });
}

test('Express query and body-parser form middleware preserve nested values and limits', async t => {
  const app = express();
  app.use(express.urlencoded({ extended: true, parameterLimit: 3 }));
  app.all('/echo', (request, response) => response.json({ query: request.query, body: request.body }));
  app.use((error, _request, response, _next) => response.status(error.status ?? 500).json({ type: error.type }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/echo`;
  const response = await fetch(`${url}?filter[name]=hello+world&tag=a&tag=b`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'person[name]=%E5%8C%BB&enabled=true',
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    query: { filter: { name: 'hello world' }, tag: ['a', 'b'] },
    body: { person: { name: '医' }, enabled: 'true' },
  });
  const excessive = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'a=1&b=2&c=3&d=4',
  });
  assert.equal(excessive.status, 413);
  assert.equal((await excessive.json()).type, 'parameters.too.many');
});
