#include <tree.hpp>
#include <trie.hpp>
#include <assert.h>

class SearchTree {
public:
    SearchTree(const TreeOfLife &tree) {
        traverse_tree(tree);
        string_trie.copy_char_trie(char_trie);
    }
    
    void write_json(JsonWriter &json) const {
        string_trie.write_json(json);
    }
    
    struct Pointer {
        int id;
        int subtree;
        
        void write_json(JsonWriter &json) const {
            json.begin('[')
                .value(id)
                .value(subtree)
                .end(']');
        }
    };
    
private:
    UnicodeTrie<Pointer> char_trie;
    StringTrie<Pointer> string_trie;
    
    void visit(const TreeOfLife &tree) {
        if (tree.name.size() > 0) {
            std::string name = tree.name;
            if (char_trie.lookup(name)) name += " (" + tree.ext_id + ")";
            //std::cerr << "storing " << name << std::endl;
            Pointer ptr = { tree.id, 666 };
            char_trie.insert(name, ptr);
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
void write_json_tree(const Tree& tree, std::string fn, std::ostream &log) {
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
    
    log << tree.name << endl;
    log << tree.total_leaves << " leaf nodes" << endl;
    log << tree.total_nodes << " nodes" << endl;
    
    log << "generating search tree..." << endl;
    SearchTree search(tree);
    write_json_tree(search, "data/search.json", log);
    
    std::list<TreeOfLife> subtrees;
    log << "decomposing..." << endl;
    std::map<int,int> subtree_parents = tree.iterative_decomposition(subtrees);
    log << "got " << subtrees.size()  << " " << subtree_parents.size() << " subtrees" << endl;
    assert(subtrees.size() == subtree_parents.size());
    
    std::list<TreeOfLife>::const_iterator itr = subtrees.begin();
    for (size_t idx = 1; idx <= subtrees.size(); ++idx) {
        std::string name = "data/subtree-"+to_string(idx)+".json";
        write_json_tree(*itr, name, log);
        itr++;
    }
    
    write_json_tree(tree, "data/root.json", log);
}
