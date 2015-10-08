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
#include <string>

#include <json.hpp>

using std::list;
using std::vector;
using std::string;
using std::runtime_error;

struct TreeOfLife {
    list<TreeOfLife> children;
    string name, name_prefix, name_id;
    int total_leaves, total_nodes;
    int subtree_index;
    
    typedef list<TreeOfLife>::const_iterator const_iterator;
    
    TreeOfLife(std::istream &newick_input) {
        init();
        read_newick(newick_input);
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
    
private:
    void init() {
        total_leaves = 0;
        total_nodes = 1;
        subtree_index = 0;
    }

    TreeOfLife() { init(); }
    
    void read_newick(std::istream &is, int depth = 0) {
        
        if (is.peek() == '(') {
            is.ignore();
            while (true) {
                children.push_back(TreeOfLife());
                TreeOfLife &child = children.back();
                
                child.read_newick(is, depth+1);
                
                total_leaves += child.total_leaves;
                total_nodes += child.total_nodes;
                
                char c = is.get();
                if (c == ',') continue;
                if (c == ')') break;
                throw runtime_error("unexpected token "+string(1, c));
            }
        } else {
            total_leaves = 1;
        }
        
        set_name(read_newick_string(is));
        
        if (depth == 0 && is.peek() == ';') is.ignore();
    }
    
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
    
    void set_name(string name_) {
        name = translate_characters(name_);
        
        if (name.size() == 0) return;
        
        int id_begin = name.find_last_of(' ');
        name_prefix = name.substr(0,id_begin);
        name_id = name.substr(id_begin+1);
        
        if (name_id.substr(0,3) != string("ott"))
            throw runtime_error("expected ott+number");
        
        if (name_prefix.size() == 0) throw runtime_error("empty name");
        if (name_id.size() == 0) throw runtime_error("empty id");
    }
    
    string translate_characters(string str) {
        std::ostringstream oss;
        bool leading_ws = true;
        for (size_t i=0; i<str.size(); ++i) {
            char c = str[i];
            switch(c) {
            case ' ':
            case '_':
                // convert underscores to spaces and drop leading space
                if (!leading_ws) oss << ' '; 
                break;
            case '\'':
                // drop all single quotes
                break;
            default:
                leading_ws = false;
                oss << c;
                break;
            }
        }
        return oss.str();
    }
};

void decompose_tree(TreeOfLife &root, list<TreeOfLife> &out,
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
    
    for(list<TreeOfLife>::iterator itr = root.children.begin();
            itr != root.children.end();
            itr++) 
        decompose_tree(*itr, out, max_subtree_size, overlap_depth);
}

void iterative_decomposition(TreeOfLife &root, list<TreeOfLife> &out) {
    
    const int DECOMPOSITION_ITR = 3;
    
    const int MAX_SUBTREE_SIZES[] = {
        500000,
        200000,
        100000
    };
    
    vector<TreeOfLife*> roots;
    roots.push_back(&root);
    
    for (int itr=0; itr < DECOMPOSITION_ITR; ++itr) {
        const int max_subtree_size = MAX_SUBTREE_SIZES[itr];
        
        std::cerr << "decomposition iteration "  << itr+1 << ", "
                  << roots.size() << " root(s)" << std::endl;
        
        size_t old_n_out = out.size();
        
        for (size_t i = 0; i < roots.size(); ++i) {
            TreeOfLife &cur_root = *roots[i];
            if (cur_root.total_nodes > max_subtree_size)
                decompose_tree(cur_root, out, max_subtree_size);
        }
        
        roots.clear();
        
        // avoid the temptation of changing out to a vector -> nasal demons
        list<TreeOfLife>::reverse_iterator root_itr = out.rbegin();
        for (size_t i = old_n_out; i < out.size(); ++i) {
            TreeOfLife &new_root = *(root_itr++);
            roots.push_back(&new_root);
        }
    }
}
