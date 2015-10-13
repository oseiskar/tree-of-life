
"use strict";

var search_tree;
var search_query;

var search_area = d3.select('#search');
var results_area = d3.select('#results');
var go_button = d3.select('#goto-link');
var go_button_action = null;

fetchSearchSubtree(0, function (data) {
    search_tree = data;
});

function searchFor(tree, prefix, callback) {
    
    if (tree.subtree_index) {
        fetchSearchSubtree(tree.subtree_index, function (subtree) {
            searchFor(subtree, prefix, callback);
        });
        return;
    }
    
    if (prefix === '') {
        callback(tree);
        return;
    }
    
    for (var key in tree.c) {
        if (prefix.indexOf(key) == 0) {
            searchFor(tree.c[key], prefix.substring(key.length), callback);
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
}

function openResult(search_result) {
    function callback() {
        resetTreeOfLife();
        expandToNode(search_result[0]);
    }
    if(!downloadSubtreePath(search_result[1], callback)) callback();
}

function displaySearchResult(query, result) {
    
    var keys = [];
    go_button_action = null;
    
    function onLineClick(l) {
        var selected = result.c[l];
        if (selected) {
            search_area.property('value', query+l);
            doSearch(query+l);
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
                resetTreeOfLife();
                updateLevels();
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
    
    lines.text(function(v) {return query+v});
}

function doSearch(query) {
    
    if (search_query === query) return;
    search_query = query;
    
    searchFor(search_tree, query, function (result) {
        if (search_query === query) {
            displaySearchResult(query, result);
        }
    });
}

function clearSearchArea() {
    search_area.property('value', '');
    go_button.classed('hidden', true);
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
        doSearch(this.value);
    }
}).on('blur', function () {
    setTimeout(function() {
        results_area.classed('hidden', true);
    }, 100);
});
