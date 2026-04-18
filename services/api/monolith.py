import subprocess
import sys
import time
import os
import signal

def main():
    print("Starting RegOS Monolith Container (API + Ingestion + RIE Pipeline)")

    # Ensure we are in the correct directory context (root of services/api)
    base_dir = os.path.dirname(os.path.abspath(__file__))
    services_dir = os.path.dirname(base_dir)

    procs = []

    def log_process(name, p):
        print(f"[{name}] Starting with PID {p.pid}")
        procs.append((name, p))

    # 1. Start FastAPI
    api_cmd = ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
    api_proc = subprocess.Popen(api_cmd, cwd=base_dir)
    log_process("API", api_proc)

    # 2. Start Ingestion
    ingestion_dir = os.path.join(services_dir, "ingestion")
    ingest_cmd = [sys.executable, "main.py"]
    ingest_proc = subprocess.Popen(ingest_cmd, cwd=ingestion_dir)
    log_process("Ingestion", ingest_proc)

    # 3. Start RIE Workers
    rie_dir = os.path.join(services_dir, "rie")
    stages = [
        "stage1_ingest.py",
        "stage2_classify.py",
        "stage3_map.py",
        "stage4_delta.py",
        "stage5_action.py"
    ]
    
    for stage in stages:
        p = subprocess.Popen([sys.executable, stage], cwd=rie_dir)
        log_process(f"RIE-{stage}", p)

    # Graceful shutdown handler
    def shutdown(signum, frame):
        print("\nReceived termination signal. Shutting down all processes...")
        for name, p in procs:
            print(f"Terminating {name}...")
            p.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        while True:
            for name, p in procs:
                if p.poll() is not None:
                    print(f"WARNING: {name} exited with code {p.returncode}")
            time.sleep(5)
    except KeyboardInterrupt:
        shutdown(None, None)

if __name__ == "__main__":
    main()
