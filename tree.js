"use strict";

var relX = d3.scale.linear()
    .domain([0, 1])
    .range([0, 2000]);

var yPadding = 20;
var canvasHeight = 700 - yPadding * 2;
    
var d3root = d3.select('#tree')
    .attr('viewBox', "0 0 2000 700")
    .append('g')
    .attr('transform', 'translate(0,' + (yPadding+canvasHeight/2) + ')' )
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
    
var rootWeight, zoom = 1.0;

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
    
    levels.each(function(data, depth) {
        
        var nodes = d3.select(this)
            .selectAll('g')
            .data(data, function (d) {return d.nodeId});
        
        var newNodes = nodes.enter()
            .append('g');
        
        if (depth > 0) newNodes.append('path');
        newNodes.append('rect');
        
        newNodes.append('text')
            .text(function(d) {return d.n})
            
        var lastLevel = depth == levelData.length - 1;
            
        (function (){
            
            function toggleExpand(d) {
                
                if (d.c) {
                    if (d.expanded)
                        removeChildren(d, depth+1);
                    else
                        expandChildren(d, d.c, depth+1);
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
            
            centerY *= 1.0 / levelWeight;
            
            var padding = levelWeight * 0.01;
            if (lastLevel)
                padding = 20.0 / canvasHeight * rootWeight;
                
            levelWeight += padding * (data.length-1);
            
            var levelX = relX(depth / levelData.length);
            
            nodes.each(function (d,i) {
                
                stashPosition(d.pos, i, 'x', levelX, 0);
                    
                var y = (weightCumsum[i] + padding*i) / levelWeight;
                y = (y - 0.5) * levelWeight / rootWeight;
                y = y * canvasHeight + centerY;
                
                minY = Math.min(minY, y);
                
                var w = d.s / rootWeight * canvasHeight;
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
            
            var texts = nodes.select('text')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (lastLevel || d.expanded) return '';
                    return 'display: none';
                })
                .transition()
                .attr('x', function(d) {return d.pos.cx;})
                .attr('y', function(d) {return d.pos.cy;})
                .attr('transform', function(d) {
                    if (lastLevel) return '';
                    var angle = 25+levelData.length;
                    return 'rotate('+angle+','+d.pos.cx+','+d.pos.cy+')';
                });
            
            if (depth == 0) return;
            
            nodes.select('path')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (d.lineOnly)
                        return 'fill: none; stroke: gray; stroke-opacity: 0.3; stroke-width: 1.0';
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
    
    zoom = (canvasHeight*0.5) / Math.max(-minY, maxY);
    //d3root.transition()
    //    .attr('transform', 'scale(1.0, ' + zoom + ')');
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
        if (isChild && d.expanded) removeChildren(d, depth+1);
        return !isChild;
    });
    if (levelData[depth].length == 0) levelData.pop();
    updateLevels();
}

d3.json('out.json', function (error, data) {
    if (error) alert(error);
    window.tol = data;
    d3.select('#loader').attr('style', 'display: none');
    
    rootWeight = 1.0 * data.s;
    expandChildren(null, [data], 0);
    expandChildren(data, data.c, 1);
    updateLevels();
});
