var tol_subtrees = {};
var tol_parent_map = {};
var search_subtrees = {};

function subtreeLoaded(id) {
    return !!tol_subtrees[''+id].data;
}

function getJsonWithErrorHandling(file, callback)  {
    
    //console.log('downloading '+file);
    
    d3.json(file, function (error, data) {
        // lousy error handling :)
        if (error) alert(error.statusText);
        else callback(data);
    });
}

function downloadSubtree(id, callback) {
    
    getJsonWithErrorHandling('data/subtree-' + id + '.json', function (data) {
        tol_subtrees[''+id].data = data.data;
        for (var key in data.parents) {
            tol_parent_map[key] = data.parents[key];
        }
        callback(data.data);
    });
}

function fetchSearchSubtree(id, callback) {
    
    if (search_subtrees[id]) {
        callback(search_subtrees[id]);
    }
    else {
        getJsonWithErrorHandling('data/search-'+id+'.json', function (data) {
            search_subtrees[id] = data;
            callback(data);
        });
    }
}

function downloadSubtreePath(id, callback) {
    var path = [id];
    
    while (true) {
        id = tol_subtrees[''+id].parent;
        if (id === undefined) break;
        path.push(id);
    }
    
    function check() {
        for (var i in path) {
            if (!subtreeLoaded(path[i])) return false;
        }
        return true;
    }
    
    if (check()) return false;
    for(var i in path) {
        if (!subtreeLoaded(path[i]))
            downloadSubtree(path[i], function(data) {
                if (check()) callback();
            });
    }
    return true;
}
