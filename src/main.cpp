#include <tree.hpp>
#include <trie.hpp>

class SearchTree {
public:
    SearchTree(const Tree &tree) {
        traverse_tree(tree);
        string_trie.copy_char_trie(char_trie);
    }
    
    size_t write_json_file(const char *fn) {
        std::ofstream file(fn);
        string_trie.write_json(file);
        return file.tellp();
    }
    
private:
    CharTrie char_trie;
    StringTrie string_trie;
    
    void visit(const Tree &tree) {
        const std::string &name = tree.name; //tree.name_prefix;
        if (name.size() > 0) {
            //std::cerr << "storing " << name << std::endl;
            char_trie.insert(name.c_str(), std::string("1"));
        }
    }
    
    void traverse_tree(const Tree& tree) {
        Tree::const_iterator c = tree.children.begin(); 
        visit(tree);
        while (c != tree.children.end()) {
            traverse_tree(*c);
             ++c;
        }
    }
};

std::ostream &format_bytes(std::ostream &os, size_t bytes) {
    os  << (bytes / 1024) << " kB";
    return os;
}

int main() {
    
    using std::endl;
    
    std::ostream &log = std::cerr;
    
    log << "reading Newick tree from stdin..." << endl;
    Tree tree;
    read_newick_tree(tree, std::cin);
    
    log << tree.name_prefix << endl;
    log << tree.total_leaves << " leaf nodes" << endl;
    log << tree.total_nodes << " nodes" << endl;
    log << Tree::max_depth << " max depth" << endl;
    
    log << "generating search tree..." << endl;
    SearchTree search(tree);
    const char *search_fn = "data/search.json";
    log << "search tree constructed, writing " << search_fn << "\t";
    format_bytes(log, search.write_json_file(search_fn)) << endl;
    
    list<Tree> subtrees;
    log << "decomposing..." << endl;
    iterative_decomposition(tree, subtrees);
    log << "got " << subtrees.size() << " subtrees" << endl;
    
    list<Tree>::const_iterator itr = subtrees.begin();
    for (size_t idx = 1; idx <= subtrees.size(); ++idx) {
        log << "writing subtree " << idx << "\t";
        string name = "data/subtree-"+to_string(idx)+".json";
        format_bytes(log, write_tree_json_file(*itr, name)) << endl;
        itr++;
    }
    
    log << "root "
         << write_tree_json_file(tree, "data/root.json") / 1024
         << " kB" << endl;
}
