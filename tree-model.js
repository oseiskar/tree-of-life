"use strict";

function TreeOfLifeBackend(root_loaded_callback) {
    
    var subtrees = {};
    var parent_map = {};
    
    function getJson(base_name, callback) {
        d3.json('data/' + base_name + '.json', function (error, data) {
            if (error) return console.warn(error);
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
    var originalChildren = [];
    data.forEach(function (c) {
        if (c.artificial) originalChildren = originalChildren.concat(c.c);
        else originalChildren.push(c);
    });
    return originalChildren;
}

TreeOfLifeModel.prototype.rotateArtificialBranch = function(node) {
    
    // quite hacky...
    
    var otherChildren = this.reexpandLargeLevel(
        node.parent.c.filter(function (c) {
            return c !== node;
        })
    );
    
    this.removeChildren(node.parent);
    
    if (node.index == 0) {
        var slicePos = Math.max(node.c.length - this.N_VISIBLE_IN_COLLAPSED, 0);
        
        var nowVisible = node.c.slice(slicePos);
        var stillCollapsed = node.c.slice(0, slicePos);
        
        if (stillCollapsed.length > 0)
            nowVisible.unshift(this.newArtificialBranch(stillCollapsed));
            
        if (otherChildren.length > 0)
            nowVisible.push(this.newArtificialBranch(otherChildren));
    }
    else {
        var nowVisible = node.c.slice(0, this.N_VISIBLE_IN_COLLAPSED);
        var stillCollapsed = node.c.slice(this.N_VISIBLE_IN_COLLAPSED);
        
        if (otherChildren.length > 0)
            nowVisible.unshift(this.newArtificialBranch(otherChildren));
        
        if (stillCollapsed.length > 2)
            nowVisible.push(this.newArtificialBranch(stillCollapsed));
        else
            nowVisible = nowVisible.concat(stillCollapsed);
    }
    
    node.parent.c = nowVisible;
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
    
    var curLevel = this.levels[level];
    
    var insertPos = 0;
    if (level > 0) {
        while (insertPos < curLevel.length &&
               curLevel[insertPos].parent.pos.index < parent.pos.index) {
            insertPos++;
        }
    }
    
    if (!parent.scaleLevel) parent.scaleLevel = 0;
    var next_scale = parent.scaleLevel;
    if (next_scale < this.RESCALE_AT.length-1 &&
        parent.s < this.RESCALE_AT[next_scale+1]*this.root_weight) next_scale++;
    
    var childCumsum = 0;
    var that = this;
    parent.c.forEach(function (d, i) {
        d.index = i
        if (!d.s) d.s = 1;
        d.expanded = false;
        d.pos = {};
        d.parentLinkPos = {};
        d.parent = parent;
        d.visual_id = that.visible_node_counter;
        d.childCumsum = childCumsum;
        d.level = level;
        d.scaleLevel = next_scale;
        d.scaledWeight = d.s / that.RESCALE_AT[d.scaleLevel];
        childCumsum += d.s; 
        that.visible_node_counter++;
        curLevel.splice(insertPos+i, 0, d);
    });
    parent.childSum = childCumsum;
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
