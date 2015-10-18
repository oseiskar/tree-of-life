/* at which proportion of the full tree weight to zoom / rescale the
 * width of the branches */
var RESCALE_AT = [1.0, 1e-3];

var SCALE_LEVEL_STYLES = {
    color: ['#408040', '#8080c0'],
    opacity: ['0.3', '0.3']
}

SCALE_LEVEL_STYLES.solid = RESCALE_AT.map(function (_, i) {
    return 'fill: ' + SCALE_LEVEL_STYLES.color[i] + '; ' +
           'fill-opacity: ' + SCALE_LEVEL_STYLES.opacity[i];
});

SCALE_LEVEL_STYLES.line = RESCALE_AT.map(function (_, i) {
    return 'fill: none; stroke: ' + SCALE_LEVEL_STYLES.color[i] + '; ' +
           'stroke-opacity: ' + SCALE_LEVEL_STYLES.opacity[i];
});

SCALE_LEVEL_STYLES.gradient = RESCALE_AT.map(function (_, i) {
    return 'fill: url(#gradient' + i + ')';
});

var textMarginLeft = 5;
var canvasPaddingRight = 100;
var canvasWidth = 1600;
var canvasHeight = 700;

var N_VISIBLE_IN_COLLAPSED = 15;

var gradients = d3.select('svg').select('defs')
    .selectAll('linearGradient')
    .data(RESCALE_AT)
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
        return "stop-color: " + SCALE_LEVEL_STYLES.color[i] + '; ' +
            "stop-opacity: " + SCALE_LEVEL_STYLES.opacity[i];
    });
    
gradients.append('stop')
    .attr('offset', '100%')
    .attr('style', function (d, i) {
        return "stop-color: " + SCALE_LEVEL_STYLES.color[i] + '; ' +
            "stop-opacity: 0";
    });
