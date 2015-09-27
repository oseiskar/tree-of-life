"use strict";

var relX = d3.scale.linear()
    .domain([0, 1])
    .range([0, 1000]);

var relY = d3.scale.linear()
    .domain([0, 1])
    .range([0, 640]);
    
var d3root = d3.select('#tree')
    .attr('viewBox', "0 0 1000 800")
    .append('g')
    .attr('transform', 'translate(0,20)');
    
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
        
        if (depth > 0) newNodes.append('path');
        newNodes.append('rect');
        
        newNodes.append('text')
            .text(function(d) {return d.n});
            
        (function (){
            
            var levelWeight = 0;
            var weightCumsum = data.map(function (d) {
                var cur = levelWeight;
                levelWeight += d.s;
                return cur;
            });
            
            var rawLevelWeight = levelWeight * 1.0;
            
            var weightFalloff = 0.5;
            var freeSpace = 0;
            if (lastLevelWeight) {
                freeSpace += (lastLevelWeight - levelWeight)*weightFalloff;
                levelWeight += freeSpace;
            }
            
            var levelX = lastLevelX;
            var levelWidth = relX(Math.pow(2, -(levelData.length-depth)));
            
            var minWidth = levelWeight * 0.01 * 0.5;
            var paddingWeight = levelWeight * 0.01;
            
            levelWeight += paddingWeight * (data.length-1);
            freeSpace -= paddingWeight * (data.length-1);
            if (freeSpace > 0 && data.length > 1)
                paddingWeight += freeSpace / (data.length-1);
            
            lastLevelWeight = rawLevelWeight;
            lastLevelX = levelX + levelWidth;
            
            nodes.each(function (d,i) {
                
                stashPosition(d.pos, i, 'x',
                    levelX,
                    levelWidth*0.1);
                    
                stashPosition(d.pos, i, 'y',
                    relY((weightCumsum[i] + paddingWeight*i) / levelWeight),
                    relY((d.s+minWidth) / levelWeight));
                
                if (depth > 0) {
                    var yRel = d.childCumsum / d.parent.childSum;
                    stashPosition(d.parentLinkPos, i, 'y',
                        yRel * d.parent.pos.ysz + d.parent.pos.y0,
                        1.0 * d.s / d.parent.childSum * d.parent.pos.ysz);
                }
            });
            
            nodes.select('text')
                .transition()
                .attr('x', function(d) {return d.pos.cx;})
                .attr('y', function(d) {return d.pos.cy;});
            
            if (depth == 0) return;
            
            nodes.select('path')
                .on('click', function (d) {
                    
                    if (d.c) {
                        if (d.expanded)
                            removeChildren(d, depth+1);
                        else
                            expandChildren(d, d.c, depth+1);
                        updateLevels();
                    }
                })
                .attr('style', function(d) {
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
                    return svgPath.moveTo(d.parent.pos.cx, d.parentLinkPos.y0) +
                        svgPath.curveTo(
                            d.parent.pos.cx + w*0.5, d.parentLinkPos.y0,
                            d.pos.cx - w*0.5, d.pos.y0,
                            d.pos.cx, d.pos.y0) +
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
    
    var childCumsum = 0;
    data.forEach(function (d, i) {
        if (!d.s) d.s = 1;
        d.expanded = false;
        d.pos = {};
        d.parentLinkPos = {};
        d.parent = parent;
        d.nodeId = nodeId;
        d.childCumsum = childCumsum;
        childCumsum += d.s; 
        nodeId++;
        curLevel.splice(insertPos+i, 0, d);
    });
    
    if (parent) parent.childSum = childCumsum;
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
    expandChildren(data, data.c, 1);
    updateLevels();
});
