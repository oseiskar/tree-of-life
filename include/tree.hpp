/*
 * An ad-hoc program for reading the tree of life in Newick format
 * and outputting it as overlapping JSON subtrees. 
 */

#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <list>
#include <map>
#include <vector>
#include <fstream>

#include <json.hpp>

using std::list;
using std::vector;
using std::string;
using std::runtime_error;

void replace_all_in_place(string &str, char target, char replacement) {
    for(size_t i=0; i<str.size(); ++i)
        if (str[i] == target) str[i] = replacement;
}

struct Tree {
    list<Tree> children;
    string name, name_prefix, name_id;
    int total_leaves, total_nodes;
    int subtree_index;
    
    typedef list<Tree>::const_iterator const_iterator;
    
    static int max_depth;
 
    Tree() :
        total_leaves(0), 
        total_nodes(1),
        subtree_index(0)
    {}
 
    void set_name(string name_) {
        name = name_;
        
        int uscore_pos = name.find_last_of('_');
        
        name_prefix = name.substr(0,uscore_pos);
        replace_all_in_place(name_prefix, '_', ' ');
        name_id = name.substr(uscore_pos+1);
    }

    void write_json(JsonWriter &json) const {
        
        json.begin('{');
        const string &name = name_prefix;
        
        if (name.size() > 0) {
            json.key("n").value(name);
        }
        
        if (children.size() > 0) {
            
            json.key("s").value(total_leaves);
            
            if (subtree_index > 0) {
                json.key("subtree_index").value(subtree_index);
            }
            
            json.key("c");
            json.begin('[');
            for (const_iterator itr = children.begin();
                itr != children.end();
                ++itr)
                itr->write_json(json);
                    
            json.end(']');
        }
        json.end('}');
    }
};

int Tree::max_depth;

string read_newick_string(std::istream &is) {
    std::ostringstream oss;
    while (true) {
        char c = is.peek();
        if (c == ',' || c == ')' || c == ';' || is.eof()) return oss.str();
        oss << c;
        is.ignore();
    }
    throw runtime_error("unexpected eof");
}

void read_newick_tree(Tree &tree, std::istream &is, int depth = 0) {
    
    if (depth == 0) Tree::max_depth = 0;
    
    if (Tree::max_depth < depth) Tree::max_depth = depth;
    
    if (is.peek() == '(') {
        is.ignore();
        while (true) {
            tree.children.push_back(Tree());
            Tree &child = tree.children.back();
            
            read_newick_tree(child, is, depth+1);
            
            tree.total_leaves += child.total_leaves;
            tree.total_nodes += child.total_nodes;
            
            char c = is.get();
            if (c == ',') continue;
            if (c == ')') break;
            throw runtime_error("unexpected token "+string(1, c));
        }
    } else {
        tree.total_leaves = 1;
    }
    
    tree.set_name(read_newick_string(is));
    
    if (depth == 0 && is.peek() == ';') is.ignore();
}

int write_tree_json_file(const Tree& tree, string fn) {
    JsonWriter json(fn);
    tree.write_json(json);
    return json.bytes_written();
}

void decompose_tree(Tree &root, list<Tree> &out,
                    const int max_subtree_size,
                    int overlap_depth = 0) {
    
    const int MAX_OVERLAP_DEPTH = 3;
    const int MIN_SUBTREE_SIZE = 10000;
    
    if (overlap_depth == 0) {
        if (root.total_nodes <= max_subtree_size &&
            root.total_nodes >= MIN_SUBTREE_SIZE) {
        
            overlap_depth = 1;
            out.push_back(root); // deep copy
            root.subtree_index = out.size();
        }
    }
    else {
        if (overlap_depth >= MAX_OVERLAP_DEPTH) {
            root.children.clear();
            return;
        }
        overlap_depth++;
    }
    
    for(list<Tree>::iterator itr = root.children.begin();
            itr != root.children.end();
            itr++) 
        decompose_tree(*itr, out, max_subtree_size, overlap_depth);
}

void iterative_decomposition(Tree &root, list<Tree> &out) {
    
    const int DECOMPOSITION_ITR = 3;
    
    const int MAX_SUBTREE_SIZES[] = {
        500000,
        200000,
        100000
    };
    
    vector<Tree*> roots;
    roots.push_back(&root);
    
    for (int itr=0; itr < DECOMPOSITION_ITR; ++itr) {
        const int max_subtree_size = MAX_SUBTREE_SIZES[itr];
        
        std::cerr << "decomposition iteration "  << itr+1 << ", "
                  << roots.size() << " root(s)" << std::endl;
        
        size_t old_n_out = out.size();
        
        for (size_t i = 0; i < roots.size(); ++i) {
            Tree &cur_root = *roots[i];
            if (cur_root.total_nodes > max_subtree_size)
                decompose_tree(cur_root, out, max_subtree_size);
        }
        
        roots.clear();
        
        // avoid the temptation of changing out to a vector -> nasal demons
        list<Tree>::reverse_iterator root_itr = out.rbegin();
        for (size_t i = old_n_out; i < out.size(); ++i) {
            Tree &new_root = *(root_itr++);
            roots.push_back(&new_root);
        }
    }
}
