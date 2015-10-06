#include <tree.hpp>

int main() {
    
    using std::cerr;
    using std::endl;
    
    Tree tree;
    read_newick_tree(tree, std::cin);
    
    cerr << tree.name_prefix << endl;
    cerr << tree.total_leaves << " leaf nodes" << endl;
    cerr << tree.total_nodes << " nodes" << endl;
    cerr << Tree::max_depth << " max depth" << endl;
    
    list<Tree> subtrees;
    cerr << "decomposing..." << endl;
    iterative_decomposition(tree, subtrees);
    cerr << "got " << subtrees.size() << " subtrees" << endl;
    
    list<Tree>::const_iterator itr = subtrees.begin();
    for (size_t idx = 1; idx <= subtrees.size(); ++idx) {
        cerr << "writing subtree " << idx;
        size_t bytes = write_tree_json_file(*itr, "data/subtree-"+to_string(idx)+".json");
        cerr << "\t" << (bytes / 1024) << " kB" << endl;
        itr++;
    }
    
    cerr << "root "
         << write_tree_json_file(tree, "data/root.json") / 1024
         << " kB" << endl;
}
