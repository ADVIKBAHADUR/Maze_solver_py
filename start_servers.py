#!/usr/bin/env python3
"""
Launcher script to start both backend (Flask) and frontend (static HTTP) servers.
Run this from the Maze_solver_py directory.
"""

import subprocess
import sys
import os
import time
import signal
from pathlib import Path

def start_backend():
    """Start the Flask backend server on port 5000"""
    backend_dir = Path(__file__).parent / "backend"
    server_file = backend_dir / "server.py"
    
    if not server_file.exists():
        print(f"❌ Error: Backend server.py not found at {server_file}")
        return None
    
    print("🚀 Starting Flask backend server on http://localhost:5000...")
    return subprocess.Popen(
        [sys.executable, "server.py"],
        cwd=str(backend_dir)
    )

def start_frontend():
    """Start the static HTTP server on port 8000"""
    frontend_dir = Path(__file__).parent
    
    print("🌐 Starting frontend static server on http://localhost:8000...")
    return subprocess.Popen(
        [sys.executable, "-m", "http.server", "8000"],
        cwd=str(frontend_dir)
    )

def main():
    """Main function to start both servers"""
    print("=" * 60)
    print("🗺️  Maze Solver - Server Launcher")
    print("=" * 60)
    print()
    
    # Start both servers
    backend_process = start_backend()
    if backend_process is None:
        sys.exit(1)
    
    # Give backend time to start
    time.sleep(1)
    
    frontend_process = start_frontend()
    
    print()
    print("=" * 60)
    print("✅ Both servers started successfully!")
    print("=" * 60)
    print()
    print("📍 Backend API:  http://localhost:5000")
    print("📍 Frontend UI:  http://localhost:8000")
    print()
    print("👉 Open http://localhost:8000 in your browser")
    print()
    print("Press Ctrl+C to stop both servers")
    print("=" * 60)
    print()
    
    # Handle graceful shutdown
    def signal_handler(sig, frame):
        print("\n\n🛑 Shutting down servers...")
        backend_process.terminate()
        frontend_process.terminate()
        try:
            backend_process.wait(timeout=5)
            frontend_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            backend_process.kill()
            frontend_process.kill()
        print("✅ Servers stopped")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Keep the script running and monitor processes
    try:
        while True:
            # Check if either process has died
            backend_poll = backend_process.poll()
            frontend_poll = frontend_process.poll()
            
            if backend_poll is not None:
                print(f"❌ Backend server stopped unexpectedly (exit code: {backend_poll})")
                frontend_process.terminate()
                sys.exit(1)
            
            if frontend_poll is not None:
                print(f"❌ Frontend server stopped unexpectedly (exit code: {frontend_poll})")
                backend_process.terminate()
                sys.exit(1)
            
            time.sleep(1)
    
    except KeyboardInterrupt:
        signal_handler(None, None)

if __name__ == "__main__":
    main()
