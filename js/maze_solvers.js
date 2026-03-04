"use strict";

function distance(point_1, point_2) {
    return Math.sqrt(Math.pow(point_2[0] - point_1[0], 2) + Math.pow(point_2[1] - point_1[1], 2));
}

function maze_solvers_interval() {
    my_interval = window.setInterval(function() {
        if (!path) {
            if (node_list_index >= node_list.length) {
                if (!found) {
                    clearInterval(my_interval);
                    return;
                }

                path = true;
                place_to_cell(start_pos[0], start_pos[1]).classList.add("cell_path");
                return;
            }

            let node = node_list[node_list_index];
            place_to_cell(node[0], node[1]).classList.add("cell_algo");
            node_list_index++;
        } else {
            if (path_list_index >= path_list.length) {
                place_to_cell(target_pos[0], target_pos[1]).classList.add("cell_path");
                clearInterval(my_interval);
                return;
            }

            let path_node = path_list[path_list_index];
            place_to_cell(path_node[0], path_node[1]).classList.remove("cell_algo");
            place_to_cell(path_node[0], path_node[1]).classList.add("cell_path");
            path_list_index++;
        }
    }, 10);
}

function breadth_first() {
    node_list = [];
    node_list_index = 0;
    path_list = [];
    path_list_index = 0;
    found = false;
    path = false;
    let frontier = [start_pos];
    grid[start_pos[0]][start_pos[1]] = 1;

    do {
        let list = get_neighbours(frontier[0], 1);
        frontier.splice(0, 1);

        for (let i = 0; i < list.length; i++)
            if (get_node(list[i][0], list[i][1]) == 0) {
                frontier.push(list[i]);
                grid[list[i][0]][list[i][1]] = i + 1;

                if (list[i][0] == target_pos[0] && list[i][1] == target_pos[1]) {
                    found = true;
                    break;
                }

                node_list.push(list[i]);
            }
    }
    while (frontier.length > 0 && !found)

    if (found) {
        let current_node = target_pos;

        while (current_node[0] != start_pos[0] || current_node[1] != start_pos[1]) {
            switch (grid[current_node[0]][current_node[1]]) {
                case 1:
                    current_node = [current_node[0], current_node[1] + 1];
                    break;
                case 2:
                    current_node = [current_node[0] - 1, current_node[1]];
                    break;
                case 3:
                    current_node = [current_node[0], current_node[1] - 1];
                    break;
                case 4:
                    current_node = [current_node[0] + 1, current_node[1]];
                    break;
                default:
                    break;
            }

            path_list.push(current_node);
        }

        path_list.pop();
        path_list.reverse();
    }

    maze_solvers_interval();
}

function bidirectional_breadth_first() {
    node_list = [];
    node_list_index = 0;
    path_list = [];
    path_list_index = 0;
    found = false;
    path = false;
    let current_cell;
    let start_end;
    let target_end;
    let frontier = [start_pos, target_pos];
    grid[target_pos[0]][target_pos[1]] = 1;
    grid[start_pos[0]][start_pos[1]] = 11;

    do {
        current_cell = frontier[0];
        let list = get_neighbours(current_cell, 1);
        frontier.splice(0, 1);

        for (let i = 0; i < list.length; i++) {
            if (get_node(list[i][0], list[i][1]) == 0) {
                frontier.push(list[i]);

                if (grid[current_cell[0]][current_cell[1]] < 10)
                    grid[list[i][0]][list[i][1]] = i + 1;
                else
                    grid[list[i][0]][list[i][1]] = 11 + i;

                node_list.push(list[i]);
            } else if (get_node(list[i][0], list[i][1]) > 0) {
                if (grid[current_cell[0]][current_cell[1]] < 10 && get_node(list[i][0], list[i][1]) > 10) {
                    start_end = current_cell;
                    target_end = list[i];
                    found = true;
                    break;
                } else if (grid[current_cell[0]][current_cell[1]] > 10 && get_node(list[i][0], list[i][1]) < 10) {
                    start_end = list[i];
                    target_end = current_cell;
                    found = true;
                    break;
                }
            }
        }
    }
    while (frontier.length > 0 && !found)

    if (found) {
        let targets = [target_pos, start_pos];
        let starts = [start_end, target_end];

        for (let i = 0; i < starts.length; i++) {
            let current_node = starts[i];

            while (current_node[0] != targets[i][0] || current_node[1] != targets[i][1]) {
                path_list.push(current_node);

                switch (grid[current_node[0]][current_node[1]] - (i * 10)) {
                    case 1:
                        current_node = [current_node[0], current_node[1] + 1];
                        break;
                    case 2:
                        current_node = [current_node[0] - 1, current_node[1]];
                        break;
                    case 3:
                        current_node = [current_node[0], current_node[1] - 1];
                        break;
                    case 4:
                        current_node = [current_node[0] + 1, current_node[1]];
                        break;
                    default:
                        break;
                }
            }

            if (i == 0)
                path_list.reverse();
        }

        path_list.reverse();
    }

    maze_solvers_interval();
}

function greedy_best_first() {
    node_list = [];
    node_list_index = 0;
    path_list = [];
    path_list_index = 0;
    found = false;
    path = false;
    let frontier = [start_pos];
    grid[start_pos[0]][start_pos[1]] = 1;

    do {
        frontier.sort(function(a, b) {
            return distance(a, target_pos) - distance(b, target_pos);
        });

        let list = get_neighbours(frontier[0], 1);
        frontier.splice(0, 1);

        for (let i = 0; i < list.length; i++)
            if (get_node(list[i][0], list[i][1]) == 0) {
                frontier.push(list[i]);
                grid[list[i][0]][list[i][1]] = i + 1;

                if (list[i][0] == target_pos[0] && list[i][1] == target_pos[1]) {
                    found = true;
                    break;
                }

                node_list.push(list[i]);
            }
    }
    while (frontier.length > 0 && !found)

    if (found) {
        let current_node = target_pos;

        while (current_node[0] != start_pos[0] || current_node[1] != start_pos[1]) {
            switch (grid[current_node[0]][current_node[1]]) {
                case 1:
                    current_node = [current_node[0], current_node[1] + 1];
                    break;
                case 2:
                    current_node = [current_node[0] - 1, current_node[1]];
                    break;
                case 3:
                    current_node = [current_node[0], current_node[1] - 1];
                    break;
                case 4:
                    current_node = [current_node[0] + 1, current_node[1]];
                    break;
                default:
                    break;
            }

            path_list.push(current_node);
        }

        path_list.pop();
        path_list.reverse();
    }

    maze_solvers_interval();
}

function dijkstra() {
    breadth_first();
}

function a_star() {
    node_list = [];
    node_list_index = 0;
    path_list = [];
    path_list_index = 0;
    found = false;
    path = false;
    let frontier = [start_pos];
    let cost_grid = new Array(grid.length).fill(0).map(() => new Array(grid[0].length).fill(0));
    grid[start_pos[0]][start_pos[1]] = 1;

    do {
        frontier.sort(function(a, b) {
            let a_value = cost_grid[a[0]][a[1]] + distance(a, target_pos) * Math.sqrt(2);
            let b_value = cost_grid[b[0]][b[1]] + distance(b, target_pos) * Math.sqrt(2);
            return a_value - b_value;
        });

        let current_cell = frontier[0];
        let list = get_neighbours(current_cell, 1);
        frontier.splice(0, 1);

        for (let i = 0; i < list.length; i++)
            if (get_node(list[i][0], list[i][1]) == 0) {
                frontier.push(list[i]);
                grid[list[i][0]][list[i][1]] = i + 1;
                cost_grid[list[i][0]][list[i][1]] = cost_grid[current_cell[0]][current_cell[1]] + 1;

                if (list[i][0] == target_pos[0] && list[i][1] == target_pos[1]) {
                    found = true;
                    break;
                }

                node_list.push(list[i]);
            }
    }
    while (frontier.length > 0 && !found)

    if (found) {
        let current_node = target_pos;

        while (current_node[0] != start_pos[0] || current_node[1] != start_pos[1]) {
            switch (grid[current_node[0]][current_node[1]]) {
                case 1:
                    current_node = [current_node[0], current_node[1] + 1];
                    break;
                case 2:
                    current_node = [current_node[0] - 1, current_node[1]];
                    break;
                case 3:
                    current_node = [current_node[0], current_node[1] - 1];
                    break;
                case 4:
                    current_node = [current_node[0] + 1, current_node[1]];
                    break;
                default:
                    break;
            }

            path_list.push(current_node);
        }

        path_list.pop();
        path_list.reverse();
    }

    maze_solvers_interval();
}

// ============================================================================
// PYTHON BACKEND INTEGRATION
// ============================================================================

function gridToMazeArray() {
    let maze = [];
    for (let i = 0; i < grid.length; i++) {
        let row = [];
        for (let j = 0; j < grid[0].length; j++) {
            row.push(grid[i][j] == -1 ? 1 : 0);
        }
        maze.push(row);
    }
    return maze;
}

async function python_solver(algorithm) {
    console.log(`Calling Python backend with ${algorithm}...`);
    const maze = gridToMazeArray();

    const requestData = {
        maze: maze,
        start: [start_pos[0], start_pos[1]],
        end: [target_pos[0], target_pos[1]],
        algorithm: algorithm
    };

    console.log('🔍 [JS] Request data:', {
        algorithm: requestData.algorithm,
        start: requestData.start,
        end: requestData.end,
        mazeSize: [maze.length, maze[0] ? maze[0].length : 0],
        mazePreview: maze.slice(0, 3).map(row => row.slice(0, 10))
    });

    try {
        const response = await fetch('http://localhost:5000/solve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        if (!response.ok)
            throw new Error(`Server returned ${response.status}`);

        const result = await response.json();
        // Expose result for Selenium
        window.lastPythonResult = result;
        // Accumulate for overlay (keyed by algo name matching ALGO_COLORS)
        if (!window.allAlgoResults) window.allAlgoResults = {};
        var overlayKey = {
            'dfs': 'DFS', 'bfs': 'BFS',
            'astar': 'AStar_h1', 'astar_h2': 'AStar_h2',
            'mdp_vi': 'MDP_VI', 'mdp_pi': 'MDP_PI'
        }[algorithm] || algorithm;
        window.allAlgoResults[overlayKey] = result;

        console.log(`Python ${algorithm} completed in ${result.time}s`);
        console.log('🔍 [JS] Response data:', {
            success: result.success,
            pathLength: result.path ? result.path.length : 0,
            visitedLength: result.visited_nodes ? result.visited_nodes.length : 0,
            path: result.path,
            error: result.error
        });

        if (result.success && result.path.length > 0) {
            node_list = [];
            node_list_index = 0;
            path_list = [];
            path_list_index = 0;
            found = true;
            path = false;

            if (result.visited_nodes && result.visited_nodes.length > 0)
                for (let i = 0; i < result.visited_nodes.length; i++) {
                    let node = result.visited_nodes[i];
                    if ((node[0] == start_pos[0] && node[1] == start_pos[1]) ||
                        (node[0] == target_pos[0] && node[1] == target_pos[1]))
                        continue;

                    node_list.push(node);
                }

            for (let i = 1; i < result.path.length - 1; i++)
                path_list.push(result.path[i]);

            if (node_list.length == 0) {
                path = true;
                place_to_cell(start_pos[0], start_pos[1]).classList.add("cell_path");
            }

            maze_solvers_interval();
        } else
            alert('No path found by Python solver!');
    } catch (error) {
        console.error('Error calling Python backend:', error);
        alert('Could not connect to Python backend. Make sure server is running!\n\nError: ' + error.message);
    }
}

function python_dfs()        { python_solver('dfs'); }

function python_bfs()        { python_solver('bfs'); }

function python_astar()      { python_solver('astar'); }

function python_astar_h2()   { python_solver('astar_h2'); }

function python_mdp_vi()     { python_solver('mdp_vi'); }

function python_mdp_pi()     { python_solver('mdp_pi'); }

function maze_solvers() {
    clear_grid();
    grid_clean = false;

    if ((Math.abs(start_pos[0] - target_pos[0]) == 0 && Math.abs(start_pos[1] - target_pos[1]) == 1) ||
        (Math.abs(start_pos[0] - target_pos[0]) == 1 && Math.abs(start_pos[1] - target_pos[1]) == 0)) {
        place_to_cell(start_pos[0], start_pos[1]).classList.add("cell_path");
        place_to_cell(target_pos[0], target_pos[1]).classList.add("cell_path");
    } else if (document.querySelector("#slct_1").value == "1")
        python_dfs();
    else if (document.querySelector("#slct_1").value == "2")
        python_bfs();
    else if (document.querySelector("#slct_1").value == "3")
        python_astar();
    else if (document.querySelector("#slct_1").value == "4")
        python_astar_h2();
    else if (document.querySelector("#slct_1").value == "5")
        python_mdp_vi();
    else if (document.querySelector("#slct_1").value == "6")
        python_mdp_pi();
}

window.maze_solvers = maze_solvers;