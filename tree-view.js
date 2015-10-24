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
        color: ['#c5d9c5', '#d8d8ec'],
        opacity: ['1.0', '1.0']
    }
    
    this.N_SCALE_LEVELS = this.SCALE_LEVELS.color.length;

    this.text_margin_left = 5;
    this.canvas = {
        width: 1600,
        height: 700
    }
    this.root_height = this.canvas.height * 0.6;

    this.defineStylesForPrimitives();
}

Style.prototype.defineStylesForPrimitives = function() {
    
    var scale_levels = d3.range(this.N_SCALE_LEVELS);
    var that = this;
    this.SCALE_LEVELS.solid = scale_levels.map(function (_, i) {
        var s = 'fill: ' + that.SCALE_LEVELS.color[i];
        var op = that.SCALE_LEVELS.opacity[i];
        if (parseFloat(op) < 1.0) s += '; fill-opacity: ' + op;
        return s;
    });

    this.SCALE_LEVELS.line = scale_levels.map(function (_, i) {
        var s = 'fill: none; stroke: ' + that.SCALE_LEVELS.color[i];
        var op = that.SCALE_LEVELS.opacity[i];
        if (parseFloat(op) < 1.0) s += '; stroke-opacity: ' + op;
        return s;
    });

    this.SCALE_LEVELS.gradient = scale_levels.map(function (_, i) {
        return 'fill: url(#gradient' + i + ')';
    });
}

Style.prototype.defineGradients = function (d3_svg_el) {
        
    var that = this;
    var gradients = d3_svg_el.append('defs')
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
        d3.select('#page-loader').classed('hidden', true);
        d3.selectAll('.bar').classed('hidden', false);
        view.render();
    });
    
    this.expandNodeCallback = function (node_id, subtree_id) {
        
        var model = view.model;
        function callback() {
            model.resetTreeOfLife();
            if (node_id !== null) model.expandToNode(node_id);
            view.tryLoaderOn();
            view.render();
        }
        
        if (node_id === null) callback();
        else {
            if (model.backend.fetchWithParents(subtree_id, callback))
                callback();
        }
    }
    
    this.style = new Style(this.model.RESCALE_AT);
    this.style.defineGradients(d3.select('#tree'));
    
    this.d3root = d3.select('#tree')
        .attr('viewBox', '0 0 '+this.style.canvas.width+' '+this.style.canvas.height)
        .append('g')
        .attr('transform', 'translate(0,' + (this.style.canvas.height/2) + ')' )
        .append('g');
        
    this.onClickNode = function (node) {
            
        search_view.clear();
        view.model.hilighted_node_id = false;
        
        function updateAgain() { view.render(); }
        
        if (node.artificial) {
            view.model.rotateArtificialBranch(node);
            updateAgain();
            
        } else if (node.c) {
            view.model.toggleExpand(node, updateAgain);
            updateAgain();
        }
        view.tryLoaderOn();
    }
};

TreeOfLifeView.prototype.refreshLoader = function (try_on, delayed) {
    var that = this;
    if (delayed) {
        setTimeout(function () { that.refreshLoader(try_on, false); }, 200);
    }
    else if (this.model.backend.requestPending() == try_on) {
        d3.select('.loader-container')
            .classed('loading-tree', try_on);
    }
}

TreeOfLifeView.prototype.tryLoaderOn = function() {
    this.refreshLoader(true, true);
}

TreeOfLifeView.prototype.tryLoaderOff = function() {
    this.refreshLoader(false, false);
}

TreeOfLifeView.prototype.render = function () {
    
    this.tryLoaderOff();
    this.computeVisualPositions();
    
    var view = this;
    
    var layers = this.d3root.selectAll('g.layer').data([
        
        // Bottom layer: paths / edges
        function (nodes, depth) {
            if (depth > 0) view.renderPaths(nodes);
        },
        
        // Top layer: texts
        function (nodes, depth) {
            var last_level = depth == view.model.levels.length - 1;
            view.renderTexts(nodes, last_level);
        }
    ]);
    
    layers.enter().append('g').attr('class', 'layer');
    
    layers.each(function (func) {
        
        var levels = d3.select(this).selectAll('g.level')
            .data(view.model.levels);
        
        levels.enter()
            .append('g')
            .attr('class', 'level');
        
        levels.exit().remove();
        
        levels.each(function(data, depth) {
            
            var nodes = d3.select(this)
                .selectAll('g')
                .data(data, function (d) { return d.visual.id; });
            
            func(nodes, depth);
            
            nodes.exit().remove();
        });
    });
    
    var zoom = Math.min((view.style.canvas.height*0.5) / Math.max(-this.min_y, this.max_y), 1.0);
    this.d3root.transition()
        .attr('transform', 'scale(' + zoom + ')');
}

TreeOfLifeView.prototype.computeVisualPositions = function() {
    
    this.min_y = -1.0;
    this.max_y = 1.0;
        
    var view = this;
    var levels = this.model.levels;
    
    var total_width = 0;
    var level_widths = levels.map(function (data, depth) {
        
        var any_named = view.selectLevelVisibleTexts(data, depth);
        
        var level_width = 1.0;
        if (any_named) { level_width += depth * 0.05; }
        if (depth <= 2) level_width += 1;
        
        if (depth < levels.length - 1) total_width += level_width;
        return level_width;
    });
    
    var abs_padding_right = 300;
    var rel_width_after_padding = 1.0 / (1 + 1.0/levels.length);
    
    var rel_x = d3.scale.linear()
        .domain([0, total_width/rel_width_after_padding])
        .range([0, this.style.canvas.width - abs_padding_right]);
    
    var sum = 0;
    this.level_x = level_widths.map(function (w) {
        var prev = sum;
        sum += w;
        return rel_x(prev);
    });
    
    levels.forEach(function (data, depth) {
        view.computeLevelVisualPositions(data, depth);
    });
}

TreeOfLifeView.prototype.selectLevelVisibleTexts = function (data, depth) {
    
    var model = this.model;
    var last_level = depth == model.levels.length - 1;
    
    var any_named = false;
    var show;
    
    data.forEach(function (d,i) {
        show = false;
        if (last_level) show = true;
        else if (d.n && !d.artificial) {
            if (d.s > model.root_weight * 0.02 || d.expanded) show = true;
            if (depth == 0 && model.levels.length > 10) show = false;
        }
        d.visual.show_text = show;
        if (show) any_named = true;
    });
    
    return any_named;
}

TreeOfLifeView.prototype.computeLevelVisualPositions = function (data, depth) {
    
    var view = this;
    var model = this.model;
    var style = view.style;
    
    var last_level = depth == model.levels.length - 1;
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
    
    function storeVisualPosition(p, index, coord, begin, width) {
    
        p[coord + '0'] = begin;
        p[coord + 'sz'] = width;
        p['c' + coord] = begin + width*0.5;
        p[coord + '1'] = begin + width;
        p.index = index;
    }
    
    data.forEach(function (d,i) {
        
        storeVisualPosition(d.visual, i, 'x', view.level_x[depth], 0);
        
        var y = (weight_cumsum[i] + padding*i) / level_weight;
        y = (y - 0.5) * level_weight / model.root_weight;
        y = y * style.root_height + center_y;
        
        view.min_y = Math.min(view.min_y, y);
        
        var w = d.scaled_weight / model.root_weight * style.root_height;
        d.visual.line_only = w < 1.0 || d.s == 1;
        
        storeVisualPosition(d.visual, i, 'y', y, w);
        
        if (depth > 0) {
            var y_rel = d.child_cumsum / d.parent.child_sum;
            storeVisualPosition(d.visual.parent_link, i, 'y',
                y_rel * d.parent.visual.ysz + d.parent.visual.y0,
                1.0 * d.s / d.parent.child_sum * d.parent.visual.ysz);
        }
        
        if (d.n) {
            d.visual.font_size = '';
            if (!d.expanded) {
                if (data.length > 20) d.visual.font_size = 10;
                if (!last_level) d.visual.font_size = 12;
            }
            
            d.visual.text_angle = 0;
            if (!last_level) {
                d.visual.text_angle = Math.min(20+model.levels.length,90);
                if (d.visual.cy < 0) d.visual.text_angle = -d.visual.text_angle;
            }
        }
        
        view.max_y = Math.max(view.max_y, y+w);
    });
}

TreeOfLifeView.prototype.renderTexts = function(nodes, last_level) {
    
    var model = this.model;
    var style = this.style;
    
    var new_nodes = nodes.enter()
        .append('g');
    
    new_nodes.append('text')
        .text(function(d) {
            if (d.n) return d.n;
            return '...';
        });
    
    nodes.select('text')
        .on('click', this.onClickNode)
        .classed('hidden', function(d) { return !d.visual.show_text; })
        .classed('selected-node', function (d) {
            return d.i === model.hilighted_node_id;
        })
        .attr('font-size', function (d) { return d.visual.font_size; })
        .transition()
        .attr('x', function(d) { return d.visual.cx + style.text_margin_left; })
        .attr('y', function(d) { return d.visual.cy; })
        .attr('transform', function(d) {
            if (!d.visual.text_angle) return '';
            var x = d.visual.cx + style.text_margin_left;
            return 'rotate('+d.visual.text_angle+','+x+','+d.visual.cy+')';
        });
}

TreeOfLifeView.prototype.renderPaths = function (nodes) {
    
    var model = this.model;
    var style = this.style;
    
    nodes.enter()
        .append('g')
        .append('path');
    
    nodes.select('path')
        .on('click', this.onClickNode)
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
            
            // try to avoid seams
            var x0 = Math.round(d.parent.visual.cx);
            var x1 = Math.round(d.visual.cx)+1;
            
            var p = SvgPath.moveTo(x0, d.visual.parent_link.y0) +
                SvgPath.curveTo(
                    x0 + w*0.5, d.visual.parent_link.y0,
                    x1 - w*0.5, d.visual.y0,
                    x1 + 1, d.visual.y0);
            
            if (d.visual.line_only) return p;
            
            return p +
                SvgPath.lineTo(x1, d.visual.y1) +
                SvgPath.curveTo(
                    x1 - w*0.5, d.visual.y1,
                    x0 + w*0.5, d.visual.parent_link.y1,
                    x0, d.visual.parent_link.y1) +
                SvgPath.close;
        });
}
