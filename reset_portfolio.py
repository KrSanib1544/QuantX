from sqlalchemy import create_engine, text
import datetime, uuid

DBS = ['quantx_local.db', 'backend/portfolio-service/portfolio.db']

target_db = None
for db in DBS:
    try:
        e = create_engine(f'sqlite:///{db}')
        with e.connect() as conn:
            tables = [t[0] for t in conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'")).fetchall()]
            print(f'{db}: tables = {tables}')
            if 'portfolios' in tables:
                port = conn.execute(text('SELECT id, cash, equity FROM portfolios LIMIT 1')).fetchone()
                print(f'  Portfolio: cash={float(port[1]):.2f}, equity={float(port[2]):.2f}')
                pos = conn.execute(text('SELECT a.symbol, p.quantity FROM positions p JOIN assets a ON a.id=p.asset_id')).fetchall()
                for s, q in pos:
                    print(f'  Position: {s} x {float(q):.2f}')
                target_db = db
    except Exception as ex:
        print(f'{db}: ERROR - {ex}')

if not target_db:
    print('No portfolio DB found')
    exit(1)

print()
print(f'Resetting portfolio in: {target_db}')

engine = create_engine(f'sqlite:///{target_db}')
with engine.begin() as conn:
    port = conn.execute(text('SELECT id FROM portfolios LIMIT 1')).fetchone()
    port_id = port[0]

    assets = conn.execute(text('SELECT id, symbol FROM assets')).fetchall()
    asset_map = {a[1]: a[0] for a in assets}

    conn.execute(text('DELETE FROM positions WHERE portfolio_id = :pid'), {'pid': port_id})
    print('Cleared all positions')

    fresh_cash = 43000.0
    fresh_equity = 170000.0
    conn.execute(text('UPDATE portfolios SET cash = :cash, equity = :eq WHERE id = :pid'),
        {'cash': fresh_cash, 'eq': fresh_equity, 'pid': port_id})

    seed = [
        ('AAPL',    150,  182.50),
        ('MSFT',     60,  415.00),
        ('TSLA',     80,  245.00),
        ('BTC-USD',   0.5, 61400.0),
    ]

    for symbol, qty, price in seed:
        asset_id = asset_map.get(symbol)
        if not asset_id:
            asset_id = str(uuid.uuid4())
            conn.execute(text('INSERT INTO assets (id, symbol, name) VALUES (:id, :sym, :sym)'),
                {'id': asset_id, 'sym': symbol})
            asset_map[symbol] = asset_id
            print(f'  Created asset: {symbol}')

        val = qty * price
        pct = val / fresh_equity * 100
        conn.execute(text('''
            INSERT INTO positions (id, portfolio_id, asset_id, quantity, average_entry_price, current_price, unrealized_pnl)
            VALUES (:id, :pid, :aid, :qty, :avg, :curr, 0.0)
        '''), {
            'id': str(uuid.uuid4()), 'pid': port_id, 'aid': asset_id,
            'qty': qty, 'avg': price, 'curr': price,
        })
        print(f'  Seeded {symbol}: {qty} @ ${price} = ${val:,.0f} ({pct:.1f}% exposure)')

print()
print(f'Done. Cash: ${fresh_cash:,.0f}  Total Equity: ${fresh_equity:,.0f}')
