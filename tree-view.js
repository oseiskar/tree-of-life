"use strict";

var SvgPath = {
    p: function (x,y) { return x + ',' + y + ' '; },
    moveTo: function (x,y) { return 'M' + SvgPath.p(x,y); },
    lineTo: function (x,y) { return 'L' + SvgPath.p(x,y); },
    curveTo: function (ctrl1x, ctrl1y, ctrl2x, ctrl2y, x, y) {
        return 'C' +
            SvgPath.p(ctrl1x, ctrl1y) +
            SvgPath.p(ctrl2x, ctrl2y) +
            SvgPath.p(x,y);
    },
    close: 'Z'
};
  
function Style() {    
    
    this.SCALE_LEVELS = {
        color: ['#408040', '#8080c0'],
        opacity: ['0.3', '0.3']
    }
    
    this.N_SCALE_LEVELS = this.SCALE_LEVELS.color.length;
    var scale_levels = d3.range(this.N_SCALE_LEVELS);

    this.text_margin_left = 5;
    this.canvas = {
        padding_right: 100,
        width: 1600,
        height: 700
    }
    this.root_height = this.canvas.height * 0.6;

    var that = this;
    this.SCALE_LEVELS.solid = scale_levels.map(function (_, i) {
        return 'fill: ' + that.SCALE_LEVELS.color[i] + '; ' +
               'fill-opacity: ' + that.SCALE_LEVELS.opacity[i];
    });

    this.SCALE_LEVELS.line = scale_levels.map(function (_, i) {
        return 'fill: none; stroke: ' + that.SCALE_LEVELS.color[i] + '; ' +
               'stroke-opacity: ' + that.SCALE_LEVELS.opacity[i];
    });

    this.SCALE_LEVELS.gradient = scale_levels.map(function (_, i) {
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
            return "stop-color: " + that.SCALE_LEVELS.color[i] + '; ' +
                "stop-opacity: " + that.SCALE_LEVELS.opacity[i];
        });
        
    gradients.append('stop')
        .attr('offset', '100%')
        .attr('style', function (d, i) {
            return "stop-color: " + that.SCALE_LEVELS.color[i] + '; ' +
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
    
    function storeVisualPosition(p, index, coord, begin, width) {
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
    
    var min_y = -1.0;
    var max_y = 1.0;
    var level_x = 0.0;
    
    levels.each(function(data, depth) {
        
        var nodes = d3.select(this)
            .selectAll('g')
            .data(data, function (d) { return d.visual.id; });
        
        var new_nodes = nodes.enter()
            .append('g');
        
        if (depth > 0) { new_nodes.append('path'); }
        new_nodes.append('rect');
        
        new_nodes.append('text')
            .text(function(d) {
                if (d.n) return d.n;
                return '...';
            });
            
        var last_level = depth == model.levels.length - 1;
            
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
            
            var center_y = 0.0;
            
            var level_weight = 0;
            var weight_cumsum = data.map(function (d) {
                var cur = level_weight;
                level_weight += d.scaled_weight;
                if (depth > 0) center_y += d.parent.visual.cy * d.scaled_weight;
                return cur;
            });
            
            center_y *= 1.0 / level_weight * 0.5;
            
            var padding = level_weight * 0.02;
            if (last_level) {
                padding = 15.0 / style.root_height * model.root_weight;
            } else if (data.length > 20) {
                padding = Math.min(2.0 / style.root_height * model.root_weight);
            }
                
            level_weight += padding * (data.length-1);
            
            nodes.each(function (d,i) {
                
                storeVisualPosition(d.visual, i, 'x', level_x, 0);
                    
                var y = (weight_cumsum[i] + padding*i) / level_weight;
                y = (y - 0.5) * level_weight / model.root_weight;
                y = y * style.root_height + center_y;
                
                min_y = Math.min(min_y, y);
                
                var w = d.scaled_weight / model.root_weight * style.root_height;
                d.visual.line_only = w < 1.0 || d.s == 1;
                
                storeVisualPosition(d.visual, i, 'y', y, w);
                
                if (depth > 0) {
                    var y_rel = d.child_cumsum / d.parent.child_sum;
                    storeVisualPosition(d.visual.parent_link, i, 'y',
                        y_rel * d.parent.visual.ysz + d.parent.visual.y0,
                        1.0 * d.s / d.parent.child_sum * d.parent.visual.ysz);
                }
                
                max_y = Math.max(max_y, y+w);
            });
            
            var any_named = false;
            
            nodes.select('text')
                .on('click', toggleExpand)
                .classed('hidden', function(d) {
                    if (last_level ||
                        (d.n && !d.artificial && (
                            d.s > model.root_weight * 0.02 ||
                            d.expanded
                        )))
                    {
                        any_named = true;
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
                        if (!last_level) return 12;
                    }
                    return '';
                })
                .transition()
                .attr('x', function(d) { return d.visual.cx + style.text_margin_left; })
                .attr('y', function(d) { return d.visual.cy; })
                .attr('transform', function(d) {
                    if (last_level) { return ''; }
                    var angle = Math.min(20+model.levels.length,90);
                    if (d.visual.cy < 0) angle = -angle;
                    var x = d.visual.cx + style.text_margin_left;
                    return 'rotate('+angle+','+x+','+d.visual.cy+')';
                });
            
            var level_width = view.rel_x(1.0 / model.levels.length);
            if (!any_named) { level_width *= 0.5; }
            level_x += level_width;
            
            if (depth === 0) { return; }
            
            nodes.select('path')
                .on('click', toggleExpand)
                .attr('style', function(d) {
                    if (d.visual.line_only) {
                        return style.SCALE_LEVELS.line[d.scale_level];
                    }
                    if (!d.expanded && d.scaled_weight > model.root_weight * 0.01) {
                        return style.SCALE_LEVELS.gradient[d.scale_level];
                    } else {
                        return style.SCALE_LEVELS.solid[d.scale_level];
                    }
                })
                .transition()
                .attr('d', function (d) {
                    var w = d.visual.cx - d.parent.visual.cx;
                    
                    var p = SvgPath.moveTo(d.parent.visual.cx, d.visual.parent_link.y0) +
                        SvgPath.curveTo(
                            d.parent.visual.cx + w*0.5, d.visual.parent_link.y0,
                            d.visual.cx - w*0.5, d.visual.y0,
                            d.visual.cx, d.visual.y0);
                    
                    if (d.visual.line_only) return p;
                    
                    return p +
                        SvgPath.lineTo(d.visual.cx, d.visual.y1) +
                        SvgPath.curveTo(
                            d.visual.cx - w*0.5, d.visual.y1,
                            d.parent.visual.cx + w*0.5, d.visual.parent_link.y1,
                            d.parent.visual.cx, d.visual.parent_link.y1) +
                        SvgPath.close;
                });
        })();
        
        nodes.exit().remove();
    });
    
    var zoom = Math.min((style.canvas.height*0.5) / Math.max(-min_y, max_y), 1.0);
    view.d3root.transition()
        .attr('transform', 'scale(' + zoom + ')');
}
