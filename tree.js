"use strict";

var d3root = d3.select('#tree')
    .attr('viewBox', "0 0 1000 800");

var relX = d3.scale.linear()
    .domain([0, 1])
    .range([0, 1000]);

var relY = d3.scale.linear()
    .domain([0, 1])
    .range([0, 700]);
    
var levelData = [];
var nodeId = 0;

function updateLevels() {
    
    function stashPositionObj(obj, index, coord, begin, width) {
        var p = obj.pos;
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
    
    var lastLevelWeight = null;
    var lastLevelX = 0;
    
    levels.each(function(data, depth) {
        
        if (depth+1 < levelData.length/5) {
            d3.select(this).selectAll('g').remove();
            return;
        };
        
        var nodes = d3.select(this)
            .selectAll('g')
            .data(data, function (d) {return d.nodeId});
        
        var newNodes = nodes.enter()
            .append('g');
        
        newNodes.append('rect');
        newNodes.append('text')
            .attr('text-anchor', 'middle')
            .text(function(d) {return d.n});
        
        if (depth > 0) newNodes.append('line');
            
        (function (){
            
            var levelWeight = 0;
            var weightCumsum = data.map(function (d) {
                var cur = levelWeight;
                levelWeight += d.s;
                return cur;
            });
            
            var rawLevelWeight = levelWeight;
            
            var weightFalloff = 0.5;
            var freeSpace = 0;
            if (lastLevelWeight) {
                freeSpace += (lastLevelWeight - levelWeight)*weightFalloff;
                levelWeight += freeSpace;
            }
            
            var levelX = lastLevelX;
            var levelWidth = relX(Math.pow(2, -(levelData.length-depth)));
            
            lastLevelWeight = levelWeight;
            lastLevelX = levelX + levelWidth;
            
            var minWidth = levelWeight * 0.01 * 0.5;
            var paddingWeight = levelWeight * 0.01;
            
            levelWeight += paddingWeight * (data.length-1);
            freeSpace -= paddingWeight * (data.length-1);
            if (freeSpace > 0 && data.length > 1)
                paddingWeight += freeSpace / (data.length-1);
            
            nodes.select('rect')
                .on('click', function (d) {
                    if (d.c) {
                        if (d.expanded)
                            removeChildren(d, depth+1);
                        else
                            expandChildren(d, d.c, depth+1);
                        updateLevels();
                    }
                })
                .attr('style', function (d){
                    if (d.c) {
                        return 'fill:gray;fill-opacity:0.4';
                    }
                    else {
                        return 'fill:gray';
                    }
                })
                .transition()
                .attr('x', function (d,i) {
                    stashPositionObj(d, i, 'x',
                        levelX,
                        levelWidth*0.9);
                    return d.pos.x0;
                })
                .attr('y', function (d,i) {
                    stashPositionObj(d, i, 'y',
                        relY((weightCumsum[i] + paddingWeight*i) / levelWeight),
                        relY((d.s+minWidth) / levelWeight));
                    return d.pos.y0;
                })
                .attr('height', function (d) {
                    return d.pos.ysz; 
                })
                .attr('width', function (d, i) {
                    return d.pos.xsz;
                });
            
            nodes.select('text')
                .transition()
                .attr('x', function(d) {return d.pos.cx;})
                .attr('y', function(d) {return d.pos.cy;});
            
            if (depth > 0) {
                nodes.select('line')
                    .attr('style', 'stroke-width: 1;stroke:gray')
                    .transition()
                    .attr('x1', function (d) {
                        return d.parent.pos.cx;
                    })
                    .attr('y1', function (d) {
                        return d.parent.pos.cy;
                    })
                    .attr('x2', function (d) {
                        return d.pos.cx;
                    })
                    .attr('y2', function (d) {
                        return d.pos.cy;
                    });
            }
            
        
        })();
        
        nodes.exit().remove();
    });
        
}

function expandChildren(parent, data, level) {
    if (parent) parent.expanded = true;
    
    while (levelData.length <= level) {
        levelData.push([]);
    }
    
    var curLevel = levelData[level];
    
    var insertPos = 0;
    if (parent) {
        while (insertPos < curLevel.length &&
               curLevel[insertPos].parent.pos.index < parent.pos.index)
            insertPos++;
    }
    
    data.forEach(function (d, i) {
        if (!d.s) d.s = 1;
        d.expanded = false;
        d.pos = {};
        d.parent = parent;
        d.nodeId = nodeId;
        nodeId++;
        curLevel.splice(insertPos+i, 0, d);
    });
}

function removeChildren(node, depth) {
    node.expanded = false;
    levelData[depth] = levelData[depth].filter(function (d) {
        var isChild = d.parent == node;
        if (d.expanded) removeChildren(d, depth+1);
        return !isChild;
    });
    if (levelData[depth].length == 0) levelData.pop();
    updateLevels();
}

d3.json('out.json', function (error, data) {
    if (error) alert(error);
    window.tol = data;
    d3.select('#loader').attr('style', 'display: none');
    
    expandChildren(null, [data], 0);
    updateLevels();
});
