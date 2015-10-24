"use strict";

function TreeOfLifeBackend(root_loaded_callback) {
    
    var subtrees = {};
    var parent_map = {};
    
    var request_counter = 0;
    
    function getJson(base_name, callback) {
        request_counter += 1;
        d3.json('data/' + base_name + '.json', function (error, data) {
            if (error) return console.warn(error);
            request_counter -= 1;
            callback(data);
        });
    }
    
    function subtreeLoaded(subtree_id) {
        var subtree = subtrees[''+subtree_id];
        return !!subtree && !!subtree.data;
    };
    
    this.fetch = function (subtree_id, callback) {
        subtree_id = ''+subtree_id;
        if (subtreeLoaded(subtree_id)) return subtrees[subtree_id].data;
        getJson('subtree-' + subtree_id, function (data) {
            subtrees[subtree_id].data = data.data;
            for (var key in data.parents) {
                parent_map[key] = data.parents[key];
            }
            callback(data.data);
        });
        return false;
    };
    
    this.fetchWithParents = function(id, callback) {
        var path = [id];
        
        while (true) {
            id = subtrees[''+id].parent;
            if (id === undefined) break;
            path.push(id);
        }
        
        function check() {
            for (var i in path) {
                if (!subtreeLoaded(path[i])) return false;
            }
            return true;
        }
        
        if (check()) return true;
        
        for(var i in path) {
            this.fetch(path[i], function(data) {
                if (check()) callback();
            });
        }
        return false;
    }
    
    this.parentIdOfNode = function(node_id) {
        return parent_map[''+node_id];
    }
    
    this.requestPending = function () { return request_counter > 0; }
    
    var that = this;
    getJson('subtree-index', function(data) {
        subtrees = data;
        that.fetch(0, function(data) {
            that.root = data;
            root_loaded_callback();
        });
    });
}

function TreeOfLifeModel(model_loaded_callback) {
    
    this.levels = [];
    this.visible_node_counter = 0;
    this.hilighted_node_id = false;
    
    /* at which proportion of the full tree weight to zoom / rescale the
     * width of the branches */
    this.RESCALE_AT = [1.0, 1e-3];
    
    this.N_VISIBLE_IN_COLLAPSED = 15;
    
    var that = this;
    this.backend = new TreeOfLifeBackend(function () {
            
        var data = that.backend.root;
        that.root_weight = 1.0 * data.s;
        
        that.expandChildren({c: [data], level: -1});
        that.expandChildren(data);
        
        model_loaded_callback();
    });
}

TreeOfLifeModel.prototype.newArtificialBranch = function(children) {
    return {
        artificial: true,
        n: "(" + children.length + " more)",
        c: children,
        s: d3.sum(children, function (c) {
            if (c.s) return c.s;
            return 1;
        })
    };
}

TreeOfLifeModel.prototype.collapseLargeLevels = function(data) {
    
    data.forEach(function (d) {if (!d.s) d.s = 1;});
    
    if (data.length < 20) return data;
    
    var that = this;
    data.sort(function (a,b) {
        if (a.i === that.hilighted_node_id) return -1;
        if (b.i === that.hilighted_node_id) return 1;
        if (a.s != b.s) return d3.descending(a.s, b.s);
        return d3.ascending(a.n, b.n);
    });
    
    var visible = data.slice(0, this.N_VISIBLE_IN_COLLAPSED);
    var collapsed = data.slice(this.N_VISIBLE_IN_COLLAPSED);
    
    visible.push(this.newArtificialBranch(collapsed));
    
    return visible;
}

TreeOfLifeModel.prototype.reexpandLargeLevel = function(data) {
    var original_children = [];
    data.forEach(function (c) {
        if (c.artificial) original_children = original_children.concat(c.c);
        else original_children.push(c);
    });
    return original_children;
}

TreeOfLifeModel.prototype.rotateArtificialBranch = function(node) {
    
    // quite hacky...
    
    var other_children = this.reexpandLargeLevel(
        node.parent.c.filter(function (c) {
            return c !== node;
        })
    );
    
    this.removeChildren(node.parent);
    
    if (node.index == 0) {
        var slice_pos = Math.max(node.c.length - this.N_VISIBLE_IN_COLLAPSED, 0);
        
        var now_visible = node.c.slice(slice_pos);
        var still_collapsed = node.c.slice(0, slice_pos);
        
        if (still_collapsed.length > 0)
            now_visible.unshift(this.newArtificialBranch(still_collapsed));
            
        if (other_children.length > 0)
            now_visible.push(this.newArtificialBranch(other_children));
    }
    else {
        var now_visible = node.c.slice(0, this.N_VISIBLE_IN_COLLAPSED);
        var still_collapsed = node.c.slice(this.N_VISIBLE_IN_COLLAPSED);
        
        if (other_children.length > 0)
            now_visible.unshift(this.newArtificialBranch(other_children));
        
        if (still_collapsed.length > 2)
            now_visible.push(this.newArtificialBranch(still_collapsed));
        else
            now_visible = now_visible.concat(still_collapsed);
    }
    
    node.parent.c = now_visible;
    this.expandChildren(node.parent);
}

TreeOfLifeModel.prototype.expandChildren = function(parent, callback) {
    
    parent.expanded = true;
    parent.c = this.collapseLargeLevels(parent.c);
    
    var level = parent.level + 1;
    
    if (parent.subtree_index) this.fetchSubtree(parent, callback);
    
    while (this.levels.length <= level) {
        this.levels.push([]);
    }
    
    var cur_level = this.levels[level];
    
    var insert_pos = 0;
    if (level > 0) {
        while (insert_pos < cur_level.length &&
               cur_level[insert_pos].parent.visual.index < parent.visual.index) {
            insert_pos++;
        }
    }
    
    if (!parent.scale_level) parent.scale_level = 0;
    var next_scale = parent.scale_level;
    if (next_scale < this.RESCALE_AT.length-1 &&
        parent.s < this.RESCALE_AT[next_scale+1]*this.root_weight) next_scale++;
    
    var child_cumsum = 0;
    var that = this;
    parent.c.forEach(function (d, i) {
        d.index = i
        if (!d.s) d.s = 1;
        d.expanded = false;
        d.parent = parent;
        d.child_cumsum = child_cumsum;
        d.level = level;
        d.scale_level = next_scale;
        d.scaled_weight = d.s / that.RESCALE_AT[d.scale_level];
        
        d.visual = {
            id: that.visible_node_counter,
            parent_link: {}
        };
        
        child_cumsum += d.s; 
        that.visible_node_counter++;
        
        cur_level.splice(insert_pos+i, 0, d);
    });
    parent.child_sum = child_cumsum;
}

TreeOfLifeModel.prototype.removeChildren = function(node) {
    node.expanded = false;
    var level = node.level + 1;
    var that = this;
    this.levels[level] = this.levels[level].filter(function (d) {
        var isChild = d.parent == node;
        if (isChild && d.expanded) that.removeChildren(d);
        return !isChild;
    });
    if (this.levels[level].length === 0) this.levels.pop();
    node.c = this.reexpandLargeLevel(node.c);
}

TreeOfLifeModel.prototype.fetchSubtree = function(node, callback) {
    
    if (node.subtree_requested) return;
    node.subtree_requested = true;
    
    var that = this;
    var existing_data = this.backend.fetch(node.subtree_index, function (data) {
        node.c = data.c;
        node.subtree_loaded = true;
        var wasExpanded = node.expanded;
        that.removeChildren(node);
        if (wasExpanded) that.expandChildren(node);
        if (callback) callback();
    });
    
    if (existing_data) {
        node.c = existing_data.c;
        node.subtree_loaded = true;
    }
}

TreeOfLifeModel.prototype.expandToNode = function(node_id) {
    var path = [node_id];
    
    while (true) {
        node_id = this.backend.parentIdOfNode(node_id);
        if (node_id === undefined || node_id == 1) break;
        path.unshift(node_id);
    }
    
    var tree = this.backend.root;
    for (var i in path) {
        var child_id = path[i];
        
        this.hilighted_node_id = child_id;
        if (tree.c) {
            if (tree.expanded) this.removeChildren(tree); 
            this.expandChildren(tree);
        }
        else break;
        
        var next_tree = null;
        for (var j in tree.c) {
            var c = tree.c[j];
            if (c.i == child_id) { 
                next_tree = c;
                break;
            }
        }
        if (!next_tree) {
            console.error("could not find child "+child_id+" from "+tree.i);
            break;
        }
        tree = next_tree;
    }
}

TreeOfLifeModel.prototype.toggleExpand = function(node, callback) {
    if (node.expanded) {
        this.removeChildren(node);
    } else {
        this.expandChildren(node, callback);
    }
}

TreeOfLifeModel.prototype.resetTreeOfLife = function() {
    this.removeChildren(this.backend.root);
    this.expandChildren(this.backend.root);
}
