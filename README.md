
# Tree of Life

This is an interactive visualization of the recently published
[Open Tree of Life](http://www.opentreeoflife.org/) using [d3.js](http://d3js.org/).
The entire tree with approximately 2.3 million identified species as leaf nodes is
browsable through the application. The width of the branches in the visualization
represents the number of species they contain.

The search feature can be used locate taxa in the tree by their scientific (Latin)
names such as _Canis lupus familiaris_, _Amanita muscaria_ or _Streptococcaceae_.

### How it works

The tree has been split into many overlapping subtrees using the C++ program
called via

    make jsons

It reads the original 80 megabyte Newick tree file `draftversion3.tre` and
outputs the subtrees in JSON format. The subtrees are lazily loaded when browsing
through the tree.

The program also constructs a prefix tree of the taxon names. This tree, which
powers the search feature, is also split into subrees that are loaded on demand.

__See also [COPYRIGHT.md](COPYRIGHT.md)__
