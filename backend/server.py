"""
Flask server for Python-based maze pathfinding algorithms.
Place this file in: Maze_solver/backend/server.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import time
from collections import deque

app = Flask(__name__)
CORS(app)  # Allow the browser to call this server

# Progress tracking for long-running algorithms
progress_store = {}


def dfs_pathfinding(maze, start, end, job_id=None, return_trace=False):
    """
    Depth-First Search pathfinding algorithm.
    
    Args:
        maze: 2D list where 0 = empty, 1 = wall
        start: tuple (row, col)
        end: tuple (row, col)
        job_id: optional ID for progress tracking
    
    Returns:
        List of (row, col) tuples representing the path
    """
    rows, cols = len(maze), len(maze[0])
    visited = set()
    visited_order = []
    path = []
    visited_count = 0
    total_cells = rows * cols
    
    def dfs(pos):
        nonlocal visited_count
        
        if pos == end:
            path.append(pos)
            return True
            
        if pos in visited or maze[pos[0]][pos[1]] == 1:
            return False
        
        visited.add(pos)
        visited_order.append(pos)
        visited_count += 1
        path.append(pos)
        
        # Update progress every 100 cells (for long mazes)
        if job_id and visited_count % 100 == 0:
            progress_store[job_id] = {
                'progress': visited_count / total_cells,
                'visited': visited_count,
                'complete': False
            }
        
        row, col = pos
        # Try all 4 directions: right, down, left, up
        for dr, dc in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            new_row, new_col = row + dr, col + dc
            
            # Check bounds
            if 0 <= new_row < rows and 0 <= new_col < cols:
                if dfs((new_row, new_col)):
                    return True
        
        # Backtrack
        path.pop()
        return False
    
    # Run DFS
    success = dfs(tuple(start))
    
    # Mark as complete
    if job_id:
        progress_store[job_id]['complete'] = True
        progress_store[job_id]['path'] = path if success else []
    
    result_path = path if success else []

    if return_trace:
        return result_path, visited_order

    return result_path


def bfs_pathfinding(maze, start, end, return_trace=False):
    """
    Breadth-First Search pathfinding (guaranteed shortest path).
    
    Args:
        maze: 2D list where 0 = empty, 1 = wall
        start: tuple (row, col)
        end: tuple (row, col)
    
    Returns:
        List of (row, col) tuples representing the shortest path
    """
    rows, cols = len(maze), len(maze[0])
    visited = set()
    visited_order = []
    queue = deque([(tuple(start), [tuple(start)])])
    visited.add(tuple(start))
    
    while queue:
        pos, path = queue.popleft()
        
        if pos == tuple(end):
            if return_trace:
                return path, visited_order
            return path
        
        row, col = pos
        # Try all 4 directions
        for dr, dc in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            new_row, new_col = row + dr, col + dc
            new_pos = (new_row, new_col)
            
            # Check bounds and if not visited
            if (0 <= new_row < rows and 
                0 <= new_col < cols and 
                new_pos not in visited and 
                maze[new_row][new_col] == 0):
                
                visited.add(new_pos)
                visited_order.append(new_pos)
                queue.append((new_pos, path + [new_pos]))
    
    if return_trace:
        return [], visited_order

    return []  # No path found


def astar_pathfinding(maze, start, end, return_trace=False):
    """
    A* pathfinding algorithm (fast + shortest path).
    
    Args:
        maze: 2D list where 0 = empty, 1 = wall
        start: tuple (row, col)
        end: tuple (row, col)
    
    Returns:
        List of (row, col) tuples representing the shortest path
    """
    import heapq
    
    rows, cols = len(maze), len(maze[0])
    start, end = tuple(start), tuple(end)
    
    def heuristic(pos):
        """Manhattan distance to goal"""
        return abs(pos[0] - end[0]) + abs(pos[1] - end[1])
    
    # Priority queue: (f_score, g_score, position, path)
    open_set = [(heuristic(start), 0, start, [start])]
    visited = set()
    visited_order = []
    
    while open_set:
        f_score, g_score, pos, path = heapq.heappop(open_set)
        
        if pos in visited:
            continue
            
        visited.add(pos)
        visited_order.append(pos)
        
        if pos == end:
            if return_trace:
                return path, visited_order
            return path
        
        row, col = pos
        # Try all 4 directions
        for dr, dc in [(0, 1), (1, 0), (0, -1), (-1, 0)]:
            new_row, new_col = row + dr, col + dc
            new_pos = (new_row, new_col)
            
            # Check bounds and if not visited
            if (0 <= new_row < rows and 
                0 <= new_col < cols and 
                new_pos not in visited and 
                maze[new_row][new_col] == 0):
                
                new_g = g_score + 1
                new_f = new_g + heuristic(new_pos)
                heapq.heappush(open_set, 
                              (new_f, new_g, new_pos, path + [new_pos]))
    
    if return_trace:
        return [], visited_order

    return []  # No path found


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
            path, visited_nodes = bfs_pathfinding(maze, start, end, return_trace=True)
        elif algorithm == 'astar':
            path, visited_nodes = astar_pathfinding(maze, start, end, return_trace=True)
        else:  # default to DFS
            path, visited_nodes = dfs_pathfinding(maze, start, end, return_trace=True)
        
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
        thread = threading.Thread(
            target=dfs_pathfinding,
            args=(data['maze'], tuple(data['start']), 
                  tuple(data['end']), job_id)
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
