
# Tree of Life

This is an interactive visualization of the recently published
[Open Tree of Life](http://www.opentreeoflife.org/) using [d3.js](http://d3js.org/).
The entire tree with approximately 2.3 million identified species as leaf nodes  
is browsable through the application.  The width of the branches represents the
number of species they contain.

The tree has been split into many overlapping subtrees using the C++ program
`tree.cpp`, called via

    make jsons

It reads the original 80 megabyte Newick tree file `draftversion3.tre`
and outputs the subtrees in JSON format. The subtrees are lazily loaded when
browsing through the tree.

As far as I know (see [COPYRIGHT.md](COPYRIGHT.md)), the tree data is licenced under 

    Creative Commons Attribution 3.0 Unported License.
    Copyright March 2015, Open Tree of Life
