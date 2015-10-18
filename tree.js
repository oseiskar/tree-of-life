"use strict";

var relX = d3.scale.linear()
    .domain([0, 1])
    .range([0, canvasWidth - canvasPaddingRight]);
    
var d3root = d3.select('#tree')
    .attr('viewBox', '0 0 '+canvasWidth+' '+canvasHeight)
    .append('g')
    .attr('transform', 'translate(0,' + (canvasHeight/2) + ')' )
    .append('g');
    
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
    
var rootHeight = canvasHeight * 0.6;

function TreeOfLifeView() {
    
    var that = this;
    this.model = new TreeOfLifeModel(function () {
        d3.select('#loader').classed('hidden', true);
        d3.selectAll('.bar').classed('hidden', false);
        updateLevels(that.model);
    });
    
    this.expandNodeCallback = function (node_id, subtree_id) {
        var model = that.model;
        function callback() {
            model.resetTreeOfLife();
            model.expandToNode(node_id);
            updateLevels(model);
        }
        if (model.backend.fetchWithParents(subtree_id, callback)) callback();
    }
};

function updateLevels(model) {
    
    function stashPosition(p, index, coord, begin, width) {
        p[coord + '0'] = begin;
        p[coord + 'sz'] = width;
        p['c' + coord] = begin + width*0.5;
        p[coord + '1'] = begin + width;
        p.index = index;
    }
    
    var levels = d3root.selectAll('g.level')
        .data(model.levels);
    
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
            .data(data, function (d) { return d.visual_id; });
        
        var newNodes = nodes.enter()
            .append('g');
        
        if (depth > 0) { newNodes.append('path'); }
        newNodes.append('rect');
        
        newNodes.append('text')
            .text(function(d) {
                if (d.n) return d.n;
                return '...';
            });
            
        var lastLevel = depth == model.levels.length - 1;
            
        (function (){
            
            function toggleExpand(d) {
                
                search_view.clear();
                model.hilighted_node_id = false;
                
                function updateAgain() { updateLevels(model); }
                
                if (d.artificial) {
                    model.rotateArtificialBranch(d);
                    updateAgain();
                    
                } else if (d.c) {
                    model.toggleExpand(d, updateAgain);
                    updateAgain();
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
                padding = 15.0 / rootHeight * model.root_weight;
            } else if (data.length > 20) {
                padding = Math.min(2.0 / rootHeight * model.root_weight);
            }
                
            levelWeight += padding * (data.length-1);
            
            nodes.each(function (d,i) {
                
                stashPosition(d.pos, i, 'x', levelX, 0);
                    
                var y = (weightCumsum[i] + padding*i) / levelWeight;
                y = (y - 0.5) * levelWeight / model.root_weight;
                y = y * rootHeight + centerY;
                
                minY = Math.min(minY, y);
                
                var w = d.scaledWeight / model.root_weight * rootHeight;
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
                            d.s > model.root_weight * 0.02 ||
                            d.expanded
                        )))
                    {
                        anyNamed = true;
                        return false;
                    }
                    return true;
                })
                .classed('selected-node', function (d) {
                    return d.i === model.hilighted_node_id;
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
                    var angle = Math.min(20+model.levels.length,90);
                    if (d.pos.cy < 0) angle = -angle;
                    var x = d.pos.cx + textMarginLeft;
                    return 'rotate('+angle+','+x+','+d.pos.cy+')';
                });
            
            var levelWidth = relX(1.0 / model.levels.length);
            if (!anyNamed) { levelWidth *= 0.5; }
            levelX += levelWidth;
            
            if (depth === 0) { return; }
            
            nodes.select('path')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (d.lineOnly) {
                        return SCALE_LEVEL_STYLES.line[d.scaleLevel];
                    }
                    if (!d.expanded && d.scaledWeight > model.root_weight * 0.01) {
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
