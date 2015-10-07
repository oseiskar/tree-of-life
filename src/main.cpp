#include <tree.hpp>
#include <trie.hpp>

class SearchTree {
public:
    SearchTree(const TreeOfLife &tree) {
        traverse_tree(tree);
        string_trie.copy_char_trie(char_trie);
    }
    
    void write_json(JsonWriter &json) const {
        string_trie.write_json(json);
    }
    
private:
    CharTrie char_trie;
    StringTrie string_trie;
    
    void visit(const TreeOfLife &tree) {
        const std::string &name = tree.name; //tree.name_prefix;
        if (name.size() > 0) {
            //std::cerr << "storing " << name << std::endl;
            char_trie.insert(name.c_str(), std::string("1"));
        }
    }
    
    void traverse_tree(const TreeOfLife& tree) {
        TreeOfLife::const_iterator c = tree.children.begin(); 
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

template <class Tree>
void write_json_tree(const Tree& tree, string fn, std::ostream &log) {
    log << "writing tree " << fn <<  "\t";
    JsonWriter json(fn);
    tree.write_json(json);
    format_bytes(log, json.bytes_written()) << std::endl;
}

int main() {
    
    using std::endl;
    
    std::ostream &log = std::cerr;
    
    log << "reading Newick tree from stdin..." << endl;
    TreeOfLife tree(std::cin);
    
    log << tree.name_prefix << endl;
    log << tree.total_leaves << " leaf nodes" << endl;
    log << tree.total_nodes << " nodes" << endl;
    
    log << "generating search tree..." << endl;
    SearchTree search(tree);
    write_json_tree(search, "data/search.json", log);
    
    list<TreeOfLife> subtrees;
    log << "decomposing..." << endl;
    iterative_decomposition(tree, subtrees);
    log << "got " << subtrees.size() << " subtrees" << endl;
    
    list<TreeOfLife>::const_iterator itr = subtrees.begin();
    for (size_t idx = 1; idx <= subtrees.size(); ++idx) {
        string name = "data/subtree-"+to_string(idx)+".json";
        write_json_tree(*itr, name, log);
        itr++;
    }
    
    write_json_tree(tree, "data/root.json", log);
}
