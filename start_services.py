import os
import sys
import time
import subprocess
import socket
import logging
import signal

# Prevent OpenBLAS/MKL thread contention memory errors on Windows
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["VECLIB_MAXIMUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"


# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] Launcher: %(message)s")
logger = logging.getLogger("Launcher")

# Services configuration
SERVICES = {
    "market-data-service": {
        "port": 8001,
        "cwd": "backend/market-data-service",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
        "env": {"OFFLINE_MODE": "true"},
        "health": "http://127.0.0.1:8001/assets"
    },
    "feature-service": {
        "port": 8002,
        "cwd": "backend/feature-service",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8002"],
        "health": "http://127.0.0.1:8002/features/AAPL"
    },
    "signal-service": {
        "port": 8003,
        "cwd": "backend/signal-service",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8003"],
        "health": "http://127.0.0.1:8003/health"
    },
    "portfolio-service": {
        "port": 8004,
        "cwd": "backend/portfolio-service",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8004"],
        "health": "http://127.0.0.1:8004/health"
    },
    "api-gateway": {
        "port": 8005,
        "cwd": "backend/api-gateway",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8005"],
        "health": "http://127.0.0.1:8005/api/health"
    },
    "ai-prediction-service": {
        "port": 8006,
        "cwd": "backend/ai-prediction-service",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8006"],
        "health": "http://127.0.0.1:8006/health"
    },
    "quantum-research-service": {
        "port": 8007,
        "cwd": "backend/quantum-research-service",
        "cmd": [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8007"],
        "health": "http://127.0.0.1:8007/health"
    },
    "frontend-dashboard": {
        "port": 3000,
        "cwd": "frontend/dashboard",
        "cmd": "npm run dev",
        "shell": True,
        "health": "http://localhost:3000"
    }
}

running_processes = {}

def check_port(port):
    """Check if a port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def kill_process_tree(pid):
    """Forcefully kill process and all its children on Windows."""
    try:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception as e:
        logger.error(f"Error killing process {pid}: {e}")

def stop_all_services():
    """Stop all running child processes."""
    logger.info("Shutting down all services...")
    for name, proc in list(running_processes.items()):
        logger.info(f"Stopping {name} (PID: {proc.pid})...")
        kill_process_tree(proc.pid)
    running_processes.clear()
    logger.info("All services shut down.")

def signal_handler(sig, frame):
    stop_all_services()
    sys.exit(0)

def main():
    # Register shutdown signals
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    os.makedirs("logs", exist_ok=True)

    # Check for port conflicts first
    conflicts = []
    for name, config in SERVICES.items():
        if check_port(config["port"]):
            conflicts.append((name, config["port"]))
    
    if conflicts:
        logger.error("Port conflicts detected! The following ports are already in use:")
        for name, port in conflicts:
            logger.error(f"  - {name} on port {port}")
        logger.error("Please shut down conflicting processes and try again.")
        sys.exit(1)

    # Start all services
    logger.info("Starting QuantX Services...")
    for name, config in SERVICES.items():
        logger.info(f"Launching {name} on port {config['port']}...")
        
        # Build env
        proc_env = os.environ.copy()
        if "env" in config:
            proc_env.update(config["env"])
            
        log_file = open(f"logs/{name}.log", "w")
        
        try:
            use_shell = config.get("shell", False)
            proc = subprocess.Popen(
                config["cmd"],
                cwd=config["cwd"],
                env=proc_env,
                stdout=log_file,
                stderr=log_file,
                shell=use_shell,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            running_processes[name] = proc
            logger.info(f"Launched {name} (PID: {proc.pid})")
        except Exception as e:
            logger.error(f"Failed to launch {name}: {e}")
            stop_all_services()
            sys.exit(1)

    # Wait for services to stand up and poll health
    logger.info("Waiting for services to initialize...")
    time.sleep(5)
    
    import urllib.request
    import urllib.error

    logger.info("Checking service health status:")
    for name, config in SERVICES.items():
        if "health" in config:
            try:
                # Custom User-Agent to bypass potential scrapers blocking
                req = urllib.request.Request(
                    config["health"], 
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=3) as response:
                    if response.status in [200, 401]: # 401 Unauthorized is healthy for auth endpoints
                        logger.info(f"  [ONLINE] {name} (Port {config['port']})")
                    else:
                        logger.warning(f"  [UNKNOWN] {name} returned status {response.status}")
            except urllib.error.HTTPError as e:
                # 401 is expected if auth JWT token is missing
                if e.code in [401, 403, 404]:
                    logger.info(f"  [ONLINE] {name} (Port {config['port']}) - Response code: {e.code}")
                else:
                    logger.warning(f"  [WARNING] {name} (Port {config['port']}) health check returned HTTP error: {e.code}")
            except Exception as e:
                logger.error(f"  [OFFLINE] {name} (Port {config['port']}) health check failed: {e}")

    logger.info("All services launched. Logs are written to the 'logs/' folder.")
    logger.info("Press Ctrl+C to stop all services.")

    # Keep script running
    try:
        while True:
            # Check if any service crashed
            for name, proc in list(running_processes.items()):
                poll = proc.poll()
                if poll is not None:
                    logger.error(f"Service {name} exited unexpectedly with code {poll}!")
                    stop_all_services()
                    sys.exit(1)
            time.sleep(1)
    except KeyboardInterrupt:
        stop_all_services()

if __name__ == "__main__":
    main()
