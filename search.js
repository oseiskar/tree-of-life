"use strict";

/**
 * An API to the prefix search tree that maps the names of the tree of life
 * nodes to the node and subtree indices of those nodes.
 * 
 * Usage:
 *      function resultCallback(query, resultTrieNode) { ... }
 *      search_model.searchFor('Canis', resultCallback)
 * 
 * where resultTrieNode is like
 * 
 *     {
 *       v: [
 *         123,   // id of the node for the node called 'Canis lupus' 
 *         2      // id of the subtree where that node is located
 *       ],
 *       c: {     // children 'Canis lupus' in the prefix tree
 *          " familiaris": { ... },
 *           ...
 *       }
 *     }
 * 
 * or null if the no name in the tree starts with the given query.
 * The member v is set only if query corresponds to the exact name of
 * some node in the tree. The member c can also be empty if query if is not
 * a proper prefix of any other node in the tree.
 * 
 */
function SearchModel(search_ready_callback) {
    
    var subtrees = {};
    var root = {};
    
    var latest_query = '';
    var request_counter = 0;
    
    var fetch = function (id, callback) {
        if (subtrees[id]) {
            callback(subtrees[id]);
        }
        else {
            d3.json('data/search-'+id+'.json', function (error, data) {
                if (error) return console.warn(error);
                subtrees[id] = data;
                callback(data);
            });
        }
    };
    
    fetch(0, function (data) {
        root = data;
        if (search_ready_callback) search_ready_callback();
    });
    
    function doSearch(tree, prefix, callback) {
    
        if (tree.subtree_index) {
            fetch(tree.subtree_index, function (subtree) {
                doSearch(subtree, prefix, callback);
            });
            return;
        }
        
        if (prefix === '') {
            callback(tree);
            return;
        }
        
        for (var key in tree.c) {
            if (prefix.indexOf(key) == 0) {
                doSearch(tree.c[key], prefix.substring(key.length), callback);
                return;
            }
            if (key.indexOf(prefix) == 0) {
                var new_tree = { c: {} };
                new_tree.c[key.substring(prefix.length)] = tree.c[key];
                callback(new_tree);
                return;
            }
        }
        callback(null);
    };
    
    this.searchFor = function(query, callback) {
        
        if (latest_query === query) return;
        latest_query = query;
        
        request_counter += 1;
        doSearch(root, latest_query, function (result) {
            request_counter -= 1;
            if (latest_query === query) {
                callback(query, result);
            }
        });
    }
    
    this.requestPending = function() { return request_counter > 0; }
}

function SearchView(result_callback) {
    var model = new SearchModel();
    
    var search_area = d3.select('#search');
    var results_area = d3.select('#results');
    var go_button = d3.select('#goto-link');
    var go_button_action = null;
    
    this.clear = function () {
        search_area.property('value', '');
        go_button.classed('hidden', true);
    }
    
    function openResult(search_result) {
        result_callback(search_result[0], search_result[1]);
    }

    function capitalize(str) {
        if (str == '') return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    function checkLoader() {
        d3.select('.loader-container')
            .classed('loading-search', model.requestPending());
    }
    
    function searchFor(query) {
        model.searchFor(query, displayResult);
        setTimeout(checkLoader, 200);
    }

    function displayResult(query, result) {
        
        checkLoader();
        
        var keys = [];
        go_button_action = null;
        
        function onLineClick(l) {
            var selected = result.c[l];
            if (selected) {
                search_area.property('value', query+l);
                searchFor(query+l);
                if (selected.v) openResult(selected.v);
            }
        }
            
        if (result === null) {
            keys = [];
            
        } else {
            keys = d3.keys(result.c);
            
            if (result.v) {
                go_button_action = (function () {
                    openResult(result.v);
                    results_area.classed('hidden', true);
                });
            } else if (keys.length == 1) {
                go_button_action = (function () {
                    onLineClick(keys[0]);
                });
            } else if (query == '') {
                go_button_action = (function () {
                    result_callback(null);
                });
            }
        }
        
        search_area.classed('not-found', result === null);
        go_button.classed('hidden', go_button_action === null);
        
        results_area.classed('hidden', 
            (query.length < 2 && keys.length > 10) ||
            (keys.length == 1 && keys[0] == ''));
        
        var data = [];
        
        keys.sort();
        for (var i in keys) {
            var key = keys[i];
            data.push(key);
            if (i > 10) {
                data.push('...');
                break;
            }
        }
        
        var lines = results_area
            .selectAll('a')
            .data(data);
        
        lines.enter()
            .append('a')
            .attr('class', 'result-line')
            .attr('href', 'javascript:void(0)');
        
        lines.on('click', function (l) { onLineClick(l); });
            
        lines.exit().remove();
        
        lines.text(function(v) {return capitalize(query+v)});
    }
    
    go_button
        .on('click', function () {
            if (go_button_action !== null) {
                go_button_action();
                go_button.classed('hidden', true);
            }
        });

    search_area.on('keyup', function () {
        if (d3.event.keyCode === 13) { // Enter pressed
            go_button.on('click')();
        }
        else {
            searchFor(capitalize(this.value));
        }
    }).on('blur', function () {
        setTimeout(function() {
            results_area.classed('hidden', true);
        }, 200);
    });
}


