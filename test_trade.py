import urllib.request, json

def req(method, url, data=None, token=None):
    body = json.dumps(data).encode() if data else None
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

if __name__ == "__main__":
    s, d = req('POST', 'http://localhost:8005/api/auth/login', {'username':'admin','password':'adminpass'})
    token = d['access_token']

    s, port = req('GET', 'http://localhost:8005/api/portfolio', token=token)
    print('New positions:')
    for pos in port.get('positions', []):
        sym = pos['symbol']
        qty = pos['quantity']
        print(f'  {sym}: qty={qty:.2f}')
    print('  Cash:', port['summary']['cash'])

    s2, trade = req('POST', 'http://localhost:8005/api/trade', {'symbol': 'MSFT', 'side': 'BUY', 'qty': 10}, token=token)
    print()
    print(f'Trade MSFT BUY 10 -> HTTP {s2}:', trade)

