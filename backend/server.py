"""
Flask server for Python-based maze pathfinding algorithms.
Place this file in: Maze_solver/backend/server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import time
from collections import deque

# Import pathfinding algorithms from the installed package
import sys
print(f"🔍 [SERVER INIT] Python path: {sys.path[:3]}")
print(f"🔍 [SERVER INIT] Importing from path_finding...")

from path_finding import bfs, dfs, astar_h1, astar_h2, mdp_value_iteration, mdp_policy_iteration
import path_finding.mdp as _mdp_module

# The path_finding __init__.py shadows the submodule names with function objects,
# so `path_finding.bfs` resolves to the *function*, not the module.
# Use importlib to get the actual submodule (and its LAST_SEARCH_STATS).
import importlib
_bfs_module = importlib.import_module('path_finding.bfs')
_dfs_module = importlib.import_module('path_finding.dfs')
_h1_module  = importlib.import_module('path_finding.Astar_h1')
_h2_module  = importlib.import_module('path_finding.Astar_h2')

print(f"🔍 [SERVER INIT] BFS module: {bfs.__module__}")
print(f"🔍 [SERVER INIT] BFS file: {bfs.__code__.co_filename if hasattr(bfs, '__code__') else 'N/A'}")

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
        
        print("\n" + "="*60)
        print("🔍 [SERVER] Received solve request:")
        print(f"  Algorithm: {algorithm}")
        print(f"  Start: {start}")
        print(f"  End: {end}")
        print(f"  Maze size: {len(maze)}x{len(maze[0]) if maze else 0}")
        print(f"  Start cell value: {maze[start[0]][start[1]] if maze else 'N/A'}")
        print(f"  End cell value: {maze[end[0]][end[1]] if maze else 'N/A'}")
        print("="*60)
        
        # Start timing
        start_time = time.perf_counter()
        print(algorithm)
        # Choose algorithm
        try:
            if algorithm == 'bfs':
                path, visited_nodes = bfs(maze, start, end, return_trace=True)
                search_stats = _bfs_module.LAST_SEARCH_STATS
            elif algorithm == 'astar':
                path, visited_nodes = astar_h1(maze, start, end, return_trace=True)
                search_stats = _h1_module.LAST_SEARCH_STATS
            elif algorithm == 'astar_h2':
                path, visited_nodes = astar_h2(maze, start, end, return_trace=True)
                search_stats = _h2_module.LAST_SEARCH_STATS
            elif algorithm == 'mdp_vi':
                path, visited_nodes = mdp_value_iteration(maze, start, end, return_trace=True)
                search_stats = _mdp_module.LAST_MDP_STATS
            elif algorithm == 'mdp_pi':
                path, visited_nodes = mdp_policy_iteration(maze, start, end, return_trace=True)
                search_stats = _mdp_module.LAST_MDP_STATS
            else:  # default to DFS
                path, visited_nodes = dfs(maze, start, end, return_trace=True)
                search_stats = _dfs_module.LAST_SEARCH_STATS
        except Exception as algo_error:
            print(f"❌ [SERVER] Algorithm error: {algo_error}")
            import traceback
            traceback.print_exc()
            raise
        
        # Calculate time taken
        elapsed_time = time.perf_counter() - start_time
        
        print(f"🔍 [SERVER] Algorithm returned:")
        print(f"  Path length: {len(path)}")
        print(f"  Visited nodes: {len(visited_nodes)}")
        print(f"  Path: {path[:5]}{'...' if len(path) > 5 else ''}")
        print(f"  Success: {len(path) > 0}")
        print(f"  Time: {elapsed_time:.6f}s")
        print("="*60 + "\n")
        
        # Attach MDP-specific planning stats if available
        mdp_stats = {}
        if algorithm in ('mdp_vi', 'mdp_pi'):
            s = _mdp_module.LAST_MDP_STATS
            mdp_stats = {
                'planning_iters':    s.get('planning_iters',    0),
                'planning_time':     s.get('planning_time',     0.0),
                'extraction_time':   s.get('extraction_time',   0.0),
                'cumulative_reward': s.get('cumulative_reward', 0.0),
                'discounted_return': s.get('discounted_return', 0.0),
                'states_valued':     s.get('states_valued',     0),
            }

        # Peak frontier and memory — available for all algorithms
        peak_frontier    = search_stats.get('peak_frontier',     0)
        peak_memory_bytes = search_stats.get('peak_memory_bytes', 0)
        print(f"  Peak frontier: {peak_frontier}  Peak memory: {peak_memory_bytes/1024:.1f} KB")

        response = {
            'path':               path,
            'visited_nodes':      visited_nodes,
            'time':               elapsed_time,
            'visited':            len(path),
            'success':            len(path) > 0,
            'peak_frontier':      peak_frontier,
            'peak_memory_bytes':  peak_memory_bytes,
        }
        response.update(mdp_stats)
        return jsonify(response)
        
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
