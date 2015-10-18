"use strict";

var tree_of_life;

var relX = d3.scale.linear()
    .domain([0, 1])
    .range([0, canvasWidth - canvasPaddingRight]);
    
var d3root = d3.select('#tree')
    .attr('viewBox', '0 0 '+canvasWidth+' '+canvasHeight)
    .append('g')
    .attr('transform', 'translate(0,' + (canvasHeight/2) + ')' )
    .append('g');
    
var levelData = [];
var nodeId = 0, selectedNodeId = false;

var svgPath = {
    p: function (x,y) { return x + ',' + y + ' '; },
    moveTo: function (x,y) { return 'M' + svgPath.p(x,y); },
    lineTo: function (x,y) { return 'L' + svgPath.p(x,y); },
    curveTo: function (ctrl1x, ctrl1y, ctrl2x, ctrl2y, x, y) {
        return 'C' +
            svgPath.p(ctrl1x, ctrl1y) +
            svgPath.p(ctrl2x, ctrl2y) +
            svgPath.p(x,y);
    },
    close: 'Z'
};
    
var rootWeight,
    rootHeight = canvasHeight * 0.6;

function updateLevels() {
    
    function stashPosition(p, index, coord, begin, width) {
        p[coord + '0'] = begin;
        p[coord + 'sz'] = width;
        p['c' + coord] = begin + width*0.5;
        p[coord + '1'] = begin + width;
        p.index = index;
    }
    
    var levels = d3root.selectAll('g.level')
        .data(levelData);
    
    levels.enter()
        .append('g')
        .attr('class', 'level');
    
    levels.exit().remove();
    
    var minY = -1.0;
    var maxY = 1.0;
    var levelX = 0.0;
    
    levels.each(function(data, depth) {
        
        var nodes = d3.select(this)
            .selectAll('g')
            .data(data, function (d) { return d.nodeId; });
        
        var newNodes = nodes.enter()
            .append('g');
        
        if (depth > 0) { newNodes.append('path'); }
        newNodes.append('rect');
        
        newNodes.append('text')
            .text(function(d) {
                if (d.n) return d.n;
                return '...';
            });
            
        var lastLevel = depth == levelData.length - 1;
            
        (function (){
            
            function toggleExpand(d) {
                
                clearSearchArea();
                selectedNodeId = false;
                
                if (d.artificial) {
                    rotateArtificialBranch(d);
                    updateLevels();
                    
                } else if (d.c) {
                    if (d.expanded) {
                        removeChildren(d);
                    } else {
                        expandChildren(d);
                    }
                    updateLevels();
                }
            }
            
            var centerY = 0.0;
            
            var levelWeight = 0;
            var weightCumsum = data.map(function (d) {
                var cur = levelWeight;
                levelWeight += d.scaledWeight;
                if (depth > 0) centerY += d.parent.pos.cy * d.scaledWeight;
                return cur;
            });
            
            centerY *= 1.0 / levelWeight * 0.5;
            
            var padding = levelWeight * 0.02;
            if (lastLevel) {
                padding = 15.0 / rootHeight * rootWeight;
            } else if (data.length > 20) {
                padding = Math.min(2.0 / rootHeight * rootWeight);
            }
                
            levelWeight += padding * (data.length-1);
            
            nodes.each(function (d,i) {
                
                stashPosition(d.pos, i, 'x', levelX, 0);
                    
                var y = (weightCumsum[i] + padding*i) / levelWeight;
                y = (y - 0.5) * levelWeight / rootWeight;
                y = y * rootHeight + centerY;
                
                minY = Math.min(minY, y);
                
                var w = d.scaledWeight / rootWeight * rootHeight;
                d.lineOnly = w < 1.0 || d.s == 1;
                
                stashPosition(d.pos, i, 'y', y, w);
                
                if (depth > 0) {
                    var yRel = d.childCumsum / d.parent.childSum;
                    stashPosition(d.parentLinkPos, i, 'y',
                        yRel * d.parent.pos.ysz + d.parent.pos.y0,
                        1.0 * d.s / d.parent.childSum * d.parent.pos.ysz);
                }
                
                maxY = Math.max(maxY, y+w);
            });
            
            var anyNamed = false;
            
            nodes.select('text')
                .on('click', toggleExpand)
                .classed('hidden', function(d) {
                    if (lastLevel ||
                        (d.n && !d.artificial && (
                            d.s > rootWeight * 0.02 ||
                            d.expanded
                        )))
                    {
                        anyNamed = true;
                        return false;
                    }
                    return true;
                })
                .classed('selected-node', function (d) {
                    return d.i === selectedNodeId;
                })
                .attr('font-size', function (d) {
                    if (!d.expanded) {
                        if (data.length > 20) return 10;
                        if (!lastLevel) return 12;
                    }
                    return '';
                })
                .transition()
                .attr('x', function(d) { return d.pos.cx + textMarginLeft; })
                .attr('y', function(d) { return d.pos.cy; })
                .attr('transform', function(d) {
                    if (lastLevel) { return ''; }
                    var angle = Math.min(20+levelData.length,90);
                    var x = d.pos.cx + textMarginLeft;
                    return 'rotate('+angle+','+x+','+d.pos.cy+')';
                });
            
            var levelWidth = relX(1.0 / levelData.length);
            if (!anyNamed) { levelWidth *= 0.5; }
            levelX += levelWidth;
            
            if (depth === 0) { return; }
            
            nodes.select('path')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (d.lineOnly) {
                        return SCALE_LEVEL_STYLES.line[d.scaleLevel];
                    }
                    if (!d.expanded && d.scaledWeight > rootWeight * 0.01) {
                        return SCALE_LEVEL_STYLES.gradient[d.scaleLevel];
                    } else {
                        return SCALE_LEVEL_STYLES.solid[d.scaleLevel];
                    }
                })
                .transition()
                .attr('d', function (d) {
                    var w = d.pos.cx - d.parent.pos.cx;
                    
                    var p = svgPath.moveTo(d.parent.pos.cx, d.parentLinkPos.y0) +
                        svgPath.curveTo(
                            d.parent.pos.cx + w*0.5, d.parentLinkPos.y0,
                            d.pos.cx - w*0.5, d.pos.y0,
                            d.pos.cx, d.pos.y0);
                    
                    if (d.lineOnly) return p;
                    
                    return p +
                        svgPath.lineTo(d.pos.cx, d.pos.y1) +
                        svgPath.curveTo(
                            d.pos.cx - w*0.5, d.pos.y1,
                            d.parent.pos.cx + w*0.5, d.parentLinkPos.y1,
                            d.parent.pos.cx, d.parentLinkPos.y1) +
                        svgPath.close;
                });
            
        
        })();
        
        nodes.exit().remove();
    });
    
    var zoom = Math.min((canvasHeight*0.5) / Math.max(-minY, maxY), 1.0);
    d3root.transition()
        .attr('transform', 'scale(' + zoom + ')');
}

function newArtificialBranch(children) {
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

function collapseLargeLevels(data) {
    
    data.forEach(function (d) {if (!d.s) d.s = 1;});
    
    if (data.length < 20) return data;
    
    data.sort(function (a,b) {
        if (a.i === selectedNodeId) return -1;
        if (b.i === selectedNodeId) return 1;
        if (a.s != b.s) return d3.descending(a.s, b.s);
        return d3.ascending(a.n, b.n);
    });
    
    var visible = data.slice(0, N_VISIBLE_IN_COLLAPSED);
    var collapsed = data.slice(N_VISIBLE_IN_COLLAPSED);
    
    visible.push(newArtificialBranch(collapsed));
    
    return visible;
}

function reexpandLargeLevel(data) {
    var originalChildren = [];
    data.forEach(function (c) {
        if (c.artificial) originalChildren = originalChildren.concat(c.c);
        else originalChildren.push(c);
    });
    return originalChildren;
}

function rotateArtificialBranch(node) {
    
    // quite hacky...
    
    var otherChildren = reexpandLargeLevel(
        node.parent.c.filter(function (c) {
            return c !== node;
        })
    );
    
    removeChildren(node.parent);
    
    if (node.index == 0) {
        var slicePos = Math.max(node.c.length - N_VISIBLE_IN_COLLAPSED, 0);
        
        var nowVisible = node.c.slice(slicePos);
        var stillCollapsed = node.c.slice(0, slicePos);
        
        if (stillCollapsed.length > 0)
            nowVisible.unshift(newArtificialBranch(stillCollapsed));
            
        if (otherChildren.length > 0)
            nowVisible.push(newArtificialBranch(otherChildren));
    }
    else {
        var nowVisible = node.c.slice(0, N_VISIBLE_IN_COLLAPSED);
        var stillCollapsed = node.c.slice(N_VISIBLE_IN_COLLAPSED);
        
        if (otherChildren.length > 0)
            nowVisible.unshift(newArtificialBranch(otherChildren));
        
        if (stillCollapsed.length > 2)
            nowVisible.push(newArtificialBranch(stillCollapsed));
        else
            nowVisible = nowVisible.concat(stillCollapsed);
    }
    
    node.parent.c = nowVisible;
    expandChildren(node.parent);
}

function expandChildren(parent) {
    
    parent.expanded = true;
    parent.c = collapseLargeLevels(parent.c);
    
    var level = parent.level + 1;
    
    if (parent.subtree_index) fetchSubtree(parent);
    
    while (levelData.length <= level) {
        levelData.push([]);
    }
    
    var curLevel = levelData[level];
    
    var insertPos = 0;
    if (level > 0) {
        while (insertPos < curLevel.length &&
               curLevel[insertPos].parent.pos.index < parent.pos.index) {
            insertPos++;
        }
    }
    
    if (!parent.scaleLevel) parent.scaleLevel = 0;
    var nextScaleLevel = parent.scaleLevel;
    if (nextScaleLevel < RESCALE_AT.length-1 &&
        parent.s < RESCALE_AT[nextScaleLevel+1]*rootWeight) nextScaleLevel++;
    
    var childCumsum = 0;
    parent.c.forEach(function (d, i) {
        d.index = i
        if (!d.s) d.s = 1;
        d.expanded = false;
        d.pos = {};
        d.parentLinkPos = {};
        d.parent = parent;
        d.nodeId = nodeId;
        d.childCumsum = childCumsum;
        d.level = level;
        d.scaleLevel = nextScaleLevel;
        d.scaledWeight = d.s / RESCALE_AT[d.scaleLevel];
        childCumsum += d.s; 
        nodeId++;
        curLevel.splice(insertPos+i, 0, d);
    });
    parent.childSum = childCumsum;
}

function removeChildren(node) {
    node.expanded = false;
    var level = node.level + 1;
    levelData[level] = levelData[level].filter(function (d) {
        var isChild = d.parent == node;
        if (isChild && d.expanded) removeChildren(d);
        return !isChild;
    });
    if (levelData[level].length === 0) levelData.pop();
    node.c = reexpandLargeLevel(node.c);
}

function fetchSubtree(node) {
    
    if (node.subtree_requested) return;
    node.subtree_requested = true;
    
    if (!downloadSubtreePath(node.subtree_index, function (data) {
        var data = tol_subtrees[''+node.subtree_index].data;
        node.c = data.c;
        node.subtree_loaded = true;
        var wasExpanded = node.expanded;
        removeChildren(node);
        if (wasExpanded) expandChildren(node);
        updateLevels();
    })) {
        var data = tol_subtrees[''+node.subtree_index].data;
        node.c = data.c;
        node.subtree_loaded = true;
    }
}

function expandToNode(nodeId) {
    var path = [nodeId];
    
    while (true) {
        nodeId = tol_parent_map[''+nodeId];
        if (nodeId === undefined || nodeId == 1) break;
        path.unshift(nodeId);
    }
    
    var tree = tree_of_life;
    for (var i in path) {
        var childId = path[i];
        
        selectedNodeId = childId;
        if (tree.c) {
            if (tree.expanded) removeChildren(tree); 
            expandChildren(tree);
        }
        else break;
        
        var nextTree = null;
        for (var j in tree.c) {
            var c = tree.c[j];
            if (c.i == childId) { 
                nextTree = c;
                break;
            }
        }
        if (!nextTree) {
            console.error("could not find child "+childId+" from "+tree.i);
            break;
        }
        tree = nextTree;
    }
    updateLevels();
}

function resetTreeOfLife() {
    removeChildren(tree_of_life);
    expandChildren(tree_of_life);
}

getJsonWithErrorHandling('data/subtree-index.json', function (data) {
    
    tol_subtrees = data;
    
    downloadSubtree(0, function (data) {
        
        tree_of_life = data;
    
        d3.select('#loader').classed('hidden', true);
        d3.selectAll('.bar').classed('hidden', false);
        rootWeight = 1.0 * data.s;
        
        expandChildren({c: [data], level: -1});
        expandChildren(data);
        updateLevels();
    });
});


