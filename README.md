
# Tree of Life

This is an interactive visualization of the recently published
[Open Tree of Life](http://www.opentreeoflife.org/) using [d3.js](http://d3js.org/).
The entire tree with approximately 2.3 million identified species as leaf nodes
is browsable through the application. The width of the branches in the
visualization represents the number of species they contain.

The search feature can be used locate taxa in the tree by their scientific
(Latin) names such as _Canis lupus familiaris_, _Amanita muscaria_ or
_Streptococcaceae_.

### How it works

The original 80+ megabyte Newick tree file is split into many overlapping
subtress stored in JSON format. This operation is done with a C++ program
invoked with `make jsons`. The subtrees are lazily loaded when browsing
through the tree.

The program also constructs a prefix tree of the taxon names. This tree, which
powers the search feature, is also split into subrees that are loaded on demand.

All the resulting data can be hosted as static files, to create a "no-backend"
web application.

### Running locally

 1. first download a suitable tree archive
    [here](https://tree.opentreeoflife.org/about/synthesis-release/v10.3)

 2. unpack and locate the `.tre` file with human-readable taxon names and
    rename it `data/source.tre`

 3. run `make jsons` (this requires `make` and `g++` installed on the system)

 4. Run `python SimpleHTTPServer` and visi http://locahost:8000.

__See also [COPYRIGHT.md](COPYRIGHT.md)__
