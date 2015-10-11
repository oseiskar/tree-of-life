
"use strict";

var search_tree;

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
