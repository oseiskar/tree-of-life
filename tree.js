"use strict";

var textMarginLeft = 5;
var canvasPaddingRight = 100;
var canvasWidth = 1600;
var canvasHeight = 700;

var relX = d3.scale.linear()
    .domain([0, 1])
    .range([0, canvasWidth - canvasPaddingRight]);
    
var d3root = d3.select('#tree')
    .attr('viewBox', '0 0 '+canvasWidth+' '+canvasHeight)
    .append('g')
    .attr('transform', 'translate(0,' + (canvasHeight/2) + ')' )
    .append('g');
    
var levelData = [];
var nodeId = 0;

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
            .data(data, function (d) {return d.nodeId});
        
        var newNodes = nodes.enter()
            .append('g');
        
        if (depth > 0) newNodes.append('path');
        newNodes.append('rect');
        
        newNodes.append('text')
            .text(function(d) {
                if (d.n) return d.n;
                return '...';
            })
            
        var lastLevel = depth == levelData.length - 1;
            
        (function (){
            
            function toggleExpand(d) {
                
                if (d.c) {
                    if (d.expanded)
                        removeChildren(d, depth+1);
                    else
                        expandChildren(d, depth+1);
                    updateLevels();
                }
            };
            
            var centerY = 0.0;
            
            var levelWeight = 0;
            var weightCumsum = data.map(function (d) {
                var cur = levelWeight;
                levelWeight += d.s;
                if (depth > 0) centerY += d.parent.pos.cy * d.s;
                return cur;
            });
            
            centerY *= 1.0 / levelWeight * 0.5;
            
            var padding = levelWeight * 0.02;
            if (lastLevel)
                padding = 15.0 / rootHeight * rootWeight;
            else if (data.length > 20) {
                padding = Math.min(2.0 / rootHeight * rootWeight);
            }
                
            levelWeight += padding * (data.length-1);
            
            nodes.each(function (d,i) {
                
                stashPosition(d.pos, i, 'x', levelX, 0);
                    
                var y = (weightCumsum[i] + padding*i) / levelWeight;
                y = (y - 0.5) * levelWeight / rootWeight;
                y = y * rootHeight + centerY;
                
                minY = Math.min(minY, y);
                
                var w = d.s / rootWeight * rootHeight;
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
            
            var texts = nodes.select('text')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (lastLevel ||
                        (d.n && !d.artificial && (
                            d.s > rootWeight * 0.02 ||
                            d.expanded
                        )))
                    {
                        anyNamed = true;
                        return '';
                    }
                    return 'display: none';
                })
                .attr('font-size', function (d) {
                    if (!d.expanded) {
                        if (data.length > 20) return 10;
                        if (!lastLevel) return 12;
                    }
                    return '';
                })
                .transition()
                .attr('x', function(d) {return d.pos.cx + textMarginLeft;})
                .attr('y', function(d) {return d.pos.cy;})
                .attr('transform', function(d) {
                    if (lastLevel) return '';
                    var angle = Math.min(20+levelData.length,90);
                    var x = d.pos.cx + textMarginLeft;
                    return 'rotate('+angle+','+x+','+d.pos.cy+')';
                });
            
            var levelWidth = relX(1.0 / levelData.length);
            if (!anyNamed) levelWidth *= 0.5;
            levelX += levelWidth;
            
            if (depth == 0) return;
            
            nodes.select('path')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (d.lineOnly)
                        return 'fill: none; stroke: gray; stroke-opacity: 0.3; stroke-width: 1.0';
                    if (!d.expanded)
                        return 'fill: url(#grad1)';
                    else
                        return 'fill: gray; fill-opacity: 0.3';
                })
                .transition()
                .attr('d', function (d) {
                    var w = d.pos.cx - d.parent.pos.cx;
                    var ctrl1 = {
                        x: d.parent.pos.cx + w*0.5,
                        y: d.parentLinkPos.cy
                    };
                    var ctrl2 = {
                        x: d.pos.cx - w*0.5,
                        y: d.pos.cy
                    };
                    
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

function collapseLargeLevels(data) {
    var maxWidth = 50;
    
    if (data.length <= maxWidth) return data;
    
    function newNode(children, name) {
        var node = {
            artificial: true,
            n: name,
            c: children,
            s: d3.sum(children, function (c) {
                if (c.s) return c.s;
                return 1;
            })
        };
        return node;
    }
    
    function isLeaf(d) { return !d.c || d.c.length==0 };
    
    var leaves = data.filter(isLeaf);
    var branches = data.filter(function (d) {!isLeaf(d)});
    
    if (leaves.length > 0 && branches.length > 0) {
        
        if (leaves.length < maxWidth && branches.length > 0) {
            leaves.push(newNode(branches, '...'));
            return leaves;
        }
        
        if (branches.length < maxWidth && leaves.length > 0) {
            branches.push(newNode(leaves, '...'));
            return branches;
        }
    
        return [
            newNode(branches, branches.length + ' branches'),
            newNode(branches, leaves.length + ' leaves'),
        ];
    }
    
    var firstHalf = data.splice(0, data.length/2);
    
    var n1 = newNode(firstHalf, '');
    var n2 = newNode(data, '');
    n1.n = '1-'+n1.s;
    n2.n = (n1.s+1)+'-'+(n1.s+n2.s);
    return [n1,n2];
}

function expandChildren(parent, level) {
    parent.expanded = true;
    parent.c = collapseLargeLevels(parent.c);
    
    while (levelData.length <= level) {
        levelData.push([]);
    }
    
    var curLevel = levelData[level];
    
    var insertPos = 0;
    if (level > 0) {
        while (insertPos < curLevel.length &&
               curLevel[insertPos].parent.pos.index < parent.pos.index)
            insertPos++;
    }
    
    var childCumsum = 0;
    parent.c.forEach(function (d, i) {
        if (!d.s) d.s = 1;
        d.expanded = false;
        d.pos = {};
        d.parentLinkPos = {};
        d.parent = parent;
        d.nodeId = nodeId;
        d.childCumsum = childCumsum;
        childCumsum += d.s; 
        nodeId++;
        if (d.subtree_index) attachSubtree(d);
        curLevel.splice(insertPos+i, 0, d);
    });
    parent.childSum = childCumsum;
}

function removeChildren(node, depth) {
    node.expanded = false;
    levelData[depth] = levelData[depth].filter(function (d) {
        var isChild = d.parent == node;
        if (isChild && d.expanded) removeChildren(d, depth+1);
        return !isChild;
    });
    if (levelData[depth].length == 0) levelData.pop();
    updateLevels();
}

function attachSubtree(node) {
    
    if (node.subtree_requested) return;
    node.subtree_requested = true;
    
    var file = 'data/subtree-' + node.subtree_index + '.json';
    console.log('fetching '+file +' for '+node.n);
    
    d3.json(file, function (error, data) {
        if (error) {
            alert(error.statusText);
            return;
        }
        console.log(error);
        node.c = data.c;
        node.subtree_loaded = true;
        console.log(file +' loaded');
        updateLevels();
    })
}

d3.json('data/root.json', function (error, data) {
    if (error) {
        alert(error.statusText);
        return;
    }
    window.tol = data;
    d3.select('#loader').attr('style', 'display: none');
    
    rootWeight = 1.0 * data.s;
    expandChildren({c: [data]}, 0);
    expandChildren(data, 1);
    updateLevels();
});
