import urllib.request, json, sys

BASE = "http://localhost:8005"

def req(method, url, data=None, token=None):
    try:
        body = json.dumps(data).encode() if data else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        r = urllib.request.Request(url, data=body, headers=headers, method=method)
        with urllib.request.urlopen(r, timeout=8) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except Exception:
            return e.code, e.reason
    except Exception as e:
        return None, str(e)

if __name__ == "__main__":
    results = []

    def check(label, method, path, data=None, token=None, expected=200):
        full_url = BASE + path
        s, d = req(method, full_url, data, token)
        ok = s == expected
        status_str = f"[{'OK' if ok else 'FAIL'}] [{s}]"
        detail = f"  => {d}" if not ok else ""
        print(f"{status_str} {method} {path}{(' ' + detail) if detail else ''}")
        results.append((ok, label, s, d))
        return s, d

    # 1. Login
    s, d = req("POST", BASE + "/api/auth/login", {"username": "admin", "password": "adminpass"})
    ok = s == 200
    print(f"[{'OK' if ok else 'FAIL'}] [{s}] Login")
    token = d.get("access_token", "") if ok else ""
    if not token:
        print("CRITICAL: Cannot get auth token.")
        sys.exit(1)

    print()
    print("=== READ ENDPOINTS ===")
    check("Portfolio", "GET", "/api/portfolio", token=token)
    check("Signals", "GET", "/api/signals", token=token)
    check("Predictions AAPL", "GET", "/api/predictions/AAPL", token=token)
    check("Risk Metrics", "GET", "/api/risk", token=token)
    check("Retrain Status", "GET", "/api/models/retrain/status", token=token)
    check("Quantum Experiments List", "GET", "/api/quantum/experiments", token=token)
    check("Quantum Kernels", "GET", "/api/quantum/kernels", token=token)
    check("Health", "GET", "/api/health", token=token)
    check("Models List", "GET", "/api/models", token=token)
    # Correct path: query param not path param
    check("Market Data (AAPL)", "GET", "/api/market-data?symbol=AAPL", token=token)
    check("Predictions AAPL Explanation", "GET", "/api/predictions/AAPL/explanation", token=token)
    check("RL Prediction AAPL", "GET", "/api/predictions/AAPL/rl?cash=45230.12&position_qty=250.0&average_entry_price=175.4", token=token)

    print()
    print("=== ACTION ENDPOINTS (BUTTONS) ===")
    check("Trigger Retrain (Button)", "POST", "/api/models/retrain", token=token)
    check("Backtest AAPL (Button)", "POST", "/api/backtest", {"symbol": "AAPL", "initial_balance": 100000}, token=token)

    # Paper Trade: use a small qty on a non-held asset to avoid hitting exposure limit
    check("Paper Trade BUY MSFT (Button)", "POST", "/api/trade", {"symbol": "MSFT", "side": "BUY", "qty": 1}, token=token)

    # Rebalance: use correct method names: "mvo", "risk_parity", or "black_litterman"
    check("Rebalance Preview MVO (Button)", "POST", "/api/portfolio/rebalance", {
        "method": "mvo",
        "execute": False,
        "market_weights": [0.45, 0.35, 0.20],
        "views": [0.02, -0.01],
        "view_link_matrix": [[1, 0, -1], [0, 1, -1]],
        "view_omega": [[0.0001, 0], [0, 0.0001]],
        "tau": 0.05
    }, token=token)

    check("Rebalance Preview Black-Litterman (Button)", "POST", "/api/portfolio/rebalance", {
        "method": "black_litterman",
        "execute": False,
        "market_weights": [0.45, 0.35, 0.20],
        "views": [0.02, -0.01],
        "view_link_matrix": [[1, 0, -1], [0, 1, -1]],
        "view_omega": [[0.0001, 0], [0, 0.0001]],
        "tau": 0.05
    }, token=token)

    check("Rebalance Preview Risk-Parity (Button)", "POST", "/api/portfolio/rebalance", {
        "method": "risk_parity",
        "execute": False
    }, token=token)

    # Quantum: correct body must include "name" + "params" dict
    s2, d2 = req("POST", BASE + "/api/quantum/experiments", {
        "name": "QA-Portfolio-Optimization-v4.2",
        "params": {"symbols": ["AAPL", "MSFT", "TSLA", "BTC-USD"], "target": "Sharpe Maximization", "kernel": "RBF-Quantum-Enhanced"}
    }, token=token)
    print(f"[{'OK' if s2==200 else 'FAIL'}] [{s2}] POST /api/quantum/experiments (create)")
    exp_id = d2.get("id") if s2 == 200 else None
    if exp_id:
        check("Quantum Run Experiment (Button)", "POST", f"/api/quantum/experiments/{exp_id}/run", token=token)
        check("Quantum Promote Strategy (Button)", "POST", f"/api/quantum/experiments/{exp_id}/promote",
              {"target_engine": "Backtest"}, token=token)
        check("Quantum Get Results", "GET", f"/api/quantum/experiments/{exp_id}/results", token=token)
    else:
        print(f"  Quantum experiment ID not found in response: {d2}")

    print()
    print("=== SUMMARY ===")
    total = len(results)
    passed = sum(1 for r in results if r[0])
    print(f"PASSED: {passed}/{total}")
    failed = [(label, s, d) for ok, label, s, d in results if not ok]
    if failed:
        print("FAILED:")
        for label, s, d in failed:
            print(f"  - {label} (HTTP {s}): {d}")
    else:
        print("All endpoints verified successfully!")

