
"use strict";

var search_tree;
var search_query;

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
    function callback() { expandToNode(search_result[0]); }
    if(!downloadSubtreePath(search_result[1], callback)) callback();
}

function displaySearchResult(query, result) {
    
    var search_area = d3.select('#search');
    var keys = [];
        
    if (result === null) {
        search_area.classed('not-found', true);
        keys = [];
    } else {
        search_area.classed('not-found', false);
        keys = d3.keys(result.c);
        d3.select('#goto-link')
            .classed('hidden', !result.v)
            .on('click', function () {openResult(result.v);});
    }
    
    d3.select('#results').classed('hidden', query.length < 2 && keys.length > 10);
    
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
    
    var lines = d3.select('#results')
        .selectAll('a')
        .data(data);
    
    lines.enter()
        .append('a')
        .attr('class', 'result-line')
        .attr('href', 'javascript:void(0)');
        
    lines.exit().remove();
    
    lines.text(function(v) {return query+v});
}

d3.select('#search').on('keyup', function (val) {
    
    var query = this.value;
    if (search_query === query) return;
    search_query = query;
    
    searchFor(search_tree, query, function (result) {
        if (search_query === query) {
            displaySearchResult(query, result);
        }
    });
});
