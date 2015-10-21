#include <tree.hpp>
#include <trie.hpp>
#include <assert.h>

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

class SearchTree {
public:
    SearchTree(std::string json_name_prefix, std::ostream &log_) :
        log(log_),
        json_prefix(json_name_prefix)
    {}

    void traverse_tree(const TreeOfLife& tree, int subtree_id) {
        TreeOfLife::const_iterator c = tree.children.begin(); 
        visit(tree, subtree_id);
        while (c != tree.children.end()) {
            traverse_tree(*c, subtree_id);
             ++c;
        }
    }
    
    void compress() {
        if (!compressed_trie.empty())
            throw std::runtime_error("already compressed");
        compressed_trie.copy_char_trie(char_trie);
    }
    
    void decompose_and_write_jsons() const {
        if (compressed_trie.empty()) throw std::runtime_error("not compressed");
        
        JsonWriter root_json(json_prefix + "0.json");
        int subtree_id = 0;
        decomposed_write_json(compressed_trie, root_json, subtree_id);
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
    StringTrie<Pointer> compressed_trie;
    
    std::ostream &log;
    std::string json_prefix;
    
    void visit(const TreeOfLife &tree, int subtree_id) {
        if (tree.name.size() > 0) {
            std::string name = tree.name;
            normalize_case(name);
            
            Pointer value = { tree.id, subtree_id };
            const Pointer* existing = char_trie.lookup(name);
            
            //std::cerr << "storing " << name << std::endl;
            
            if (existing) {
                if (existing->id == tree.id) return;
                name += " (" + tree.ext_id + ")";
                existing = char_trie.lookup(name);
                if (existing && existing->id == tree.id) return;
            }
            char_trie.insert(name, value);
        }
    }
    
    void decomposed_write_json(
            const StringTrie<Pointer> &tree,
            JsonWriter &root_json,
            int &subtree_index) const {
        
        const int MAX_SUBTREE_SIZE = 120000;
        const int MIN_SUBTREE_SIZE = 2000;
        
        root_json.begin('{');
        
        if (tree.total_nodes <= MAX_SUBTREE_SIZE && tree.total_nodes >= MIN_SUBTREE_SIZE) {
            int idx = ++subtree_index;
            root_json.key("subtree_index").value(idx);
            std::string name = json_prefix + to_string(idx) + ".json";
            write_json_tree(tree, name, log);
        }
        else {
        
            if (tree.children.size() > 0) {
                root_json.key("c");
                root_json.begin('{');
                
                for(StringTrie<Pointer>::const_iterator c = tree.children.begin(); 
                    c != tree.children.end();
                    ++c)
                {
                    root_json.key(c->first);
                    decomposed_write_json(c->second, root_json, subtree_index);
                }
                root_json.end('}');
            }
            
            if (tree.has_value) {
                root_json.key("v").value(tree.value);
            }
        }
        
        root_json.end('}');
    }
    
    /** Capitalizes the first letter of the string (if an ASCII char) */
    void normalize_case(std::string &str) {
        assert(str.size() > 0);
        if (str[0] >= 'a' && str[0] <= 'z') str[0] = str[0] + ('A'-'a');
    }
};

void write_subtree_index_json(const std::map<int,int> &parent_map) {
    JsonWriter json("data/subtree-index.json");
    json.begin('{');
    
    json.key("0").begin('{').end('}');
    
    for(std::map<int,int>::const_iterator itr = parent_map.begin();
        itr != parent_map.end();
        ++itr)
        json.key(to_string(itr->first))
            .begin('{')
                .key("parent").value(itr->second)
            .end('}');
    json.end('}');
}

int main() {
    
    using std::endl;
    
    std::ostream &log = std::cerr;
    
    log << "reading Newick tree from stdin..." << endl;
    TreeOfLife tree(std::cin);
    
    log << tree.name << endl;
    log << tree.total_leaves << " leaf nodes" << endl;
    log << tree.total_nodes << " nodes" << endl;
    
    std::list<TreeOfLife> subtrees;
    log << "decomposing..." << endl;
    std::map<int,int> subtree_parents = tree.iterative_decomposition(subtrees);
    log << "got " << subtrees.size() << " subtrees" << endl;
    assert(subtrees.size() == subtree_parents.size()+1);
    
    write_subtree_index_json(subtree_parents);
    
    log << "generating search tree and writing subtree jsons..." << endl;
    SearchTree search("data/search-", log);
    
    std::list<TreeOfLife>::const_iterator itr = subtrees.begin();
    for (size_t subtree_id = 0; subtree_id < subtrees.size(); ++subtree_id) {
        search.traverse_tree(*itr, subtree_id);
        std::string name = "data/subtree-"+to_string(subtree_id)+".json";
        write_json_tree(*itr, name, log);
        itr++;
    }
    
    log << "compressing search tree..." << endl;
    search.compress();
    
    search.decompose_and_write_jsons();
}
