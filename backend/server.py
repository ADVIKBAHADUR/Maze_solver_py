"""
Flask server for Python-based maze pathfinding algorithms.
Place this file in: Maze_solver/backend/server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import time
from collections import deque

# Import pathfinding algorithms from the installed package
from path_finding import bfs, dfs, astar_h1, astar_h2

app = Flask(__name__)
CORS(app)  # Allow the browser to call this server

# Progress tracking for long-running algorithms
progress_store = {}


@app.route('/solve', methods=['POST'])
def solve():
    """
    Main endpoint for solving mazes.
    
    Expected JSON:
    {
        "maze": [[0,1,0], [0,0,0], [1,0,0]],  # 2D array
        "start": [0, 0],                       # [row, col]
        "end": [2, 2],                         # [row, col]
        "algorithm": "dfs"                     # "dfs", "bfs", or "astar"
    }
    
    Returns:
    {
        "path": [[0,0], [1,0], [1,1], [2,1], [2,2]],  # Solution path
        "time": 0.023,                                  # Seconds
        "visited": 15                                   # Cells explored
    }
    """
    try:
        data = request.json
        maze = data['maze']
        start = tuple(data['start'])
        end = tuple(data['end'])
        algorithm = data.get('algorithm', 'dfs').lower()
        
        # Start timing
        start_time = time.time()
        
        # Choose algorithm
        if algorithm == 'bfs':
            path, visited_nodes = bfs(maze, start, end, return_trace=True)
        elif algorithm == 'astar':
            path, visited_nodes = astar_h1(maze, start, end, return_trace=True)
        elif algorithm == 'astar_h2':
            path, visited_nodes = astar_h2(maze, start, end, return_trace=True)
        else:  # default to DFS
            path, visited_nodes = dfs(maze, start, end, return_trace=True)
        
        # Calculate time taken
        elapsed_time = time.time() - start_time
        
        return jsonify({
            'path': path,
            'visited_nodes': visited_nodes,
            'time': round(elapsed_time, 3),
            'visited': len(path),
            'success': len(path) > 0
        })
        
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        }), 400


@app.route('/solve-async', methods=['POST'])
def solve_async():
    """
    Start a long-running pathfinding job.
    Returns a job_id to poll for progress.
    """
    import threading
    
    try:
        data = request.json
        job_id = f"job_{int(time.time() * 1000)}"
        
        # Initialize progress
        progress_store[job_id] = {
            'progress': 0,
            'visited': 0,
            'complete': False
        }
        
        # Start pathfinding in background
        algorithm = data.get('algorithm', 'dfs').lower()
        target_func = dfs
        if algorithm == 'bfs':
            target_func = bfs
        elif algorithm == 'astar':
            target_func = astar_h1
        elif algorithm == 'astar_h2':
            target_func = astar_h2
        
        thread = threading.Thread(
            target=target_func,
            args=(data['maze'], tuple(data['start']), 
                  tuple(data['end']), True)
        )
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'job_id': job_id,
            'message': 'Job started'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/progress/<job_id>', methods=['GET'])
def get_progress(job_id):
    """
    Get progress of a long-running job.
    
    Returns:
    {
        "progress": 0.75,      # 0-1
        "visited": 3450,       # cells explored
        "complete": false,
        "path": [...]          # only when complete
    }
    """
    progress = progress_store.get(job_id, {
        'error': 'Job not found'
    })
    return jsonify(progress)


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'active_jobs': len(progress_store)
    })


if __name__ == '__main__':
    print("🚀 Maze Solver Server Starting...")
    print("📍 Server will run at: http://localhost:5000")
    print("🔧 Endpoints:")
    print("   POST /solve - Solve a maze")
    print("   POST /solve-async - Start long-running job")
    print("   GET /progress/<job_id> - Check job progress")
    print("   GET /health - Health check")
    print("\n✨ Ready to solve mazes!\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
