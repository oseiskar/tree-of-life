"use strict";

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
  
function Style() {    
    
    this.SCALE_LEVEL_STYLES = {
        color: ['#408040', '#8080c0'],
        opacity: ['0.3', '0.3']
    }
    
    this.N_SCALE_LEVELS = this.SCALE_LEVEL_STYLES.color.length;
    var scale_levels = d3.range(this.N_SCALE_LEVELS);

    this.text_margin_left = 5;
    this.canvas = {
        padding_right: 100,
        width: 1600,
        height: 700
    }
    this.root_height = this.canvas.height * 0.6;

    var that = this;
    this.SCALE_LEVEL_STYLES.solid = scale_levels.map(function (_, i) {
        return 'fill: ' + that.SCALE_LEVEL_STYLES.color[i] + '; ' +
               'fill-opacity: ' + that.SCALE_LEVEL_STYLES.opacity[i];
    });

    this.SCALE_LEVEL_STYLES.line = scale_levels.map(function (_, i) {
        return 'fill: none; stroke: ' + that.SCALE_LEVEL_STYLES.color[i] + '; ' +
               'stroke-opacity: ' + that.SCALE_LEVEL_STYLES.opacity[i];
    });

    this.SCALE_LEVEL_STYLES.gradient = scale_levels.map(function (_, i) {
        return 'fill: url(#gradient' + i + ')';
    });
}

Style.prototype.defineGradients = function (d3_svg_el) {
        
    var that = this;
    var gradients = d3_svg_el.select('defs')
        .selectAll('linearGradient')
        .data(d3.range(this.N_SCALE_LEVELS))
        .enter()
        .append('linearGradient')
        .attr('id', function (d, i) { return 'gradient' + i; })
        .attr('x1', '0%')
        .attr('y1', '0%')
        .attr('x2', '100%')
        .attr('y2', '0%');

    gradients.append('stop')
        .attr('offset', '0%')
        .attr('style', function (d, i) {
            return "stop-color: " + that.SCALE_LEVEL_STYLES.color[i] + '; ' +
                "stop-opacity: " + that.SCALE_LEVEL_STYLES.opacity[i];
        });
        
    gradients.append('stop')
        .attr('offset', '100%')
        .attr('style', function (d, i) {
            return "stop-color: " + that.SCALE_LEVEL_STYLES.color[i] + '; ' +
                "stop-opacity: 0";
        });
}

function TreeOfLifeView() {
    
    var view = this;
    this.model = new TreeOfLifeModel(function () {
        d3.select('#loader').classed('hidden', true);
        d3.selectAll('.bar').classed('hidden', false);
        view.render();
    });
    
    this.expandNodeCallback = function (node_id, subtree_id) {
        var model = view.model;
        function callback() {
            model.resetTreeOfLife();
            model.expandToNode(node_id);
            view.render();
        }
        if (model.backend.fetchWithParents(subtree_id, callback)) callback();
    }
    
    this.style = new Style(this.model.RESCALE_AT);
    this.style.defineGradients(d3.select('svg'));
    
    this.rel_x = d3.scale.linear()
        .domain([0, 1])
        .range([0, this.style.canvas.width - this.style.canvas.padding_right]);
    
    this.d3root = d3.select('#tree')
        .attr('viewBox', '0 0 '+this.style.canvas.width+' '+this.style.canvas.height)
        .append('g')
        .attr('transform', 'translate(0,' + (this.style.canvas.height/2) + ')' )
        .append('g');
};

TreeOfLifeView.prototype.render = function () {
    
    var view = this;
    var model = this.model;
    var style = view.style;
    
    function stashPosition(p, index, coord, begin, width) {
        p[coord + '0'] = begin;
        p[coord + 'sz'] = width;
        p['c' + coord] = begin + width*0.5;
        p[coord + '1'] = begin + width;
        p.index = index;
    }
    
    var levels = this.d3root.selectAll('g.level')
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
                
                function updateAgain() { view.render(); }
                
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
                padding = 15.0 / style.root_height * model.root_weight;
            } else if (data.length > 20) {
                padding = Math.min(2.0 / style.root_height * model.root_weight);
            }
                
            levelWeight += padding * (data.length-1);
            
            nodes.each(function (d,i) {
                
                stashPosition(d.pos, i, 'x', levelX, 0);
                    
                var y = (weightCumsum[i] + padding*i) / levelWeight;
                y = (y - 0.5) * levelWeight / model.root_weight;
                y = y * style.root_height + centerY;
                
                minY = Math.min(minY, y);
                
                var w = d.scaledWeight / model.root_weight * style.root_height;
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
                .attr('x', function(d) { return d.pos.cx + style.text_margin_left; })
                .attr('y', function(d) { return d.pos.cy; })
                .attr('transform', function(d) {
                    if (lastLevel) { return ''; }
                    var angle = Math.min(20+model.levels.length,90);
                    if (d.pos.cy < 0) angle = -angle;
                    var x = d.pos.cx + style.text_margin_left;
                    return 'rotate('+angle+','+x+','+d.pos.cy+')';
                });
            
            var levelWidth = view.rel_x(1.0 / model.levels.length);
            if (!anyNamed) { levelWidth *= 0.5; }
            levelX += levelWidth;
            
            if (depth === 0) { return; }
            
            nodes.select('path')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (d.lineOnly) {
                        return style.SCALE_LEVEL_STYLES.line[d.scaleLevel];
                    }
                    if (!d.expanded && d.scaledWeight > model.root_weight * 0.01) {
                        return style.SCALE_LEVEL_STYLES.gradient[d.scaleLevel];
                    } else {
                        return style.SCALE_LEVEL_STYLES.solid[d.scaleLevel];
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
    
    var zoom = Math.min((style.canvas.height*0.5) / Math.max(-minY, maxY), 1.0);
    view.d3root.transition()
        .attr('transform', 'scale(' + zoom + ')');
}
