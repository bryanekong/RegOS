import subprocess
import sys
import time

def main():
    scripts = [
        "stage1_ingest.py",
        "stage2_classify.py",
        "stage3_map.py",
        "stage4_delta.py",
        "stage5_action.py"
    ]
    
    processes = []
    print("Starting all 5 RIE Worker stages in a single unified container...")
    
    for script in scripts:
        print(f"Launching {script}...")
        p = subprocess.Popen([sys.executable, script])
        processes.append((script, p))
        
    try:
        # Keep the main thread alive while workers listen on Supabase queues
        while True:
            for script, p in processes:
                if p.poll() is not None:
                    print(f"WARNING: {script} crashed or exited with code {p.returncode}")
            time.sleep(10)
    except KeyboardInterrupt:
        print("\nShutting down all workers...")
        for script, p in processes:
            p.terminate()

if __name__ == "__main__":
    main()
