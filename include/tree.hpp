#ifndef __TREE_HPP
#define __TREE_HPP

#include <iostream>
#include <sstream>
#include <string>
#include <stdexcept>
#include <list>
#include <map>
#include <vector>
#include <string>
#include <assert.h>

#include <json.hpp>

class TreeOfLife {
public:
    std::string name, ext_id;
    int id;
    int total_leaves, total_nodes;
    
    std::list<TreeOfLife> children;
    
    typedef std::list<TreeOfLife>::const_iterator const_iterator;
    
    TreeOfLife(std::istream &newick_input) {
        int global_id = 1;
        init(global_id);
        read_newick(newick_input, 0, global_id);
    }

    void write_json(JsonWriter &json) const {
        std::map<int, int> parent_map;
        generate_parent_map(parent_map);
        json.begin('{');
        
        json.key("data");
        write_content_json(json);
        
        json.key("parents");
        json.begin('{');
        for(std::map<int, int>::const_iterator itr = parent_map.begin();
            itr != parent_map.end(); ++itr)
            json.key(to_string(itr->first)).value(itr->second);
        json.end('}');
        
        json.end('}');
    }
    
    /**
     * An ad-hoc methods for splitting the tree of tree of life to overlapping
     * subtrees
     */
    std::map<int,int> iterative_decomposition(std::list<TreeOfLife> &out) {
        
        const int DECOMPOSITION_ITR = 3;
        
        const int MAX_SUBTREE_SIZES[] = {
            500000,
            100000,
            50000
        };
        
        std::map<int,int> parent_map;
        
        typedef std::pair<TreeOfLife*,int> TreeIdPair;
        std::vector<TreeIdPair> roots;
        roots.push_back(TreeIdPair(this,0));
        
        for (int itr=0; itr < DECOMPOSITION_ITR; ++itr) {
            const int max_subtree_size = MAX_SUBTREE_SIZES[itr];
            
            std::vector<TreeIdPair> new_roots;
            
            std::cerr << "decomposition iteration "  << itr+1 << ", "
                      << roots.size() << " root(s)" << std::endl;
            
            for (size_t i = 0; i < roots.size(); ++i) {
                const size_t old_n_out = out.size();
                
                TreeOfLife &cur_root = *roots[i].first;
                const int root_id = roots[i].second;
                
                if (cur_root.total_nodes > max_subtree_size)
                    cur_root.decompose(out, max_subtree_size);
                    
                // avoid the temptation of changing out to a vector -> nasal demons
                std::list<TreeOfLife>::reverse_iterator root_itr = out.rbegin();
                for (size_t tree_id = out.size(); tree_id > old_n_out; --tree_id) {
                    TreeOfLife &new_root = *(root_itr++);
                    new_roots.push_back(TreeIdPair(&new_root, tree_id));
                    parent_map[tree_id] = root_id;
                }
            }
            
            roots = new_roots;
        }
        out.push_front(*this);
        return parent_map;
    }
    
    typedef std::runtime_error error;
    
private:
    int subtree_index;

    void init(int &global_id) {
        id = global_id++;
        total_leaves = 0;
        total_nodes = 1;
        subtree_index = 0;
    }

    TreeOfLife(int &global_id) { init(global_id); }
    
    void read_newick(std::istream &is, int depth, int &global_id) {
        
        if (is.peek() == '(') {
            is.ignore();
            while (true) {
                children.push_back(TreeOfLife(global_id));
                TreeOfLife &child = children.back();
                
                child.read_newick(is, depth+1, global_id);
                
                total_leaves += child.total_leaves;
                total_nodes += child.total_nodes;
                
                char c = is.get();
                if (c == ',') continue;
                if (c == ')') break;
                throw error("unexpected token "+std::string(1, c));
            }
        } else {
            total_leaves = 1;
        }
        
        set_name(read_newick_string(is));
        
        if (depth == 0 && is.peek() == ';') is.ignore();
    }
    
    std::string read_newick_string(std::istream &is) {
        std::ostringstream oss;
        bool quoted = is.peek() == '\'';
        bool last_quote = false;
        
        if (quoted) is.ignore();
        while (true) {
            char c = is.peek();
            
            if (c == '\'') {
                if (!quoted) throw error("unexpected quote after "+oss.str());
                if (!last_quote) {
                    last_quote = true;
                    is.ignore();
                    continue;
                }
                last_quote = false;
            }
            if (((last_quote || !quoted) && (c == ',' || c == ')' || c == ';')) || is.eof()) return oss.str();
            else if (last_quote) throw error("expected quote after "+oss.str());
            
            if (c == '_') c = ' ';
            oss << c;
            is.ignore();
        }
        throw error("unexpected eof");
    }
    
    void set_name(std::string name_) {
        // drop leading whitespace
        while(name_.size() > 0 && name_[0] == ' ') name_ = name_.substr(1);
        name = name_;

        int id_begin = name.find_last_of(' ');

        // detect id-only nodes
        if (id_begin < 0) name.clear();
        if (name.size() == 0) return;

        name = name_.substr(0,id_begin);
        ext_id = name_.substr(id_begin+1);

        if (ext_id.substr(0,3) != std::string("ott"))
            throw error("expected ott+number, not "+ext_id);
        
        if (name.size() == 0) throw error("empty name");
        if (ext_id.size() == 0) throw error("empty ext_id");
    }
    
    void write_content_json(JsonWriter &json) const {
        json.begin('{');
        
        json.key("i").value(id);
        if (name.size() > 0) json.key("n").value(name);
        
        if (total_leaves > 1) json.key("s").value(total_leaves);
            
        if (subtree_index > 0) {
            json.key("subtree_index").value(subtree_index);
        }
        
        if (children.size() > 0) {
            
            json.key("c");
            json.begin('[');
            for (const_iterator itr = children.begin();
                itr != children.end();
                ++itr)
                itr->write_content_json(json);
                    
            json.end(']');
        }
        json.end('}');
    }
    
    void generate_parent_map(std::map<int, int>& parent_map, int parent_id = -1) const {
        if (parent_id != -1) parent_map[id] = parent_id;
        for (const_iterator itr = children.begin();
            itr != children.end();
            ++itr)
            itr->generate_parent_map(parent_map, id);
    }
    
    void decompose(std::list<TreeOfLife> &out,
                    const int max_subtree_size,
                    int overlap_depth = 0) {
        
        const int MAX_OVERLAP_DEPTH = 1;
        const int MIN_SUBTREE_SIZE = 10000;
        
        if (overlap_depth == 0) {
            if (total_nodes <= max_subtree_size &&
                total_nodes >= MIN_SUBTREE_SIZE) {
            
                overlap_depth = 1;
                out.push_back(*this); // deep copy
                subtree_index = out.size();
            }
        }
        else {
            if (overlap_depth >= MAX_OVERLAP_DEPTH) {
                children.clear();
                return;
            }
            overlap_depth++;
        }
        
        for(std::list<TreeOfLife>::iterator itr = children.begin();
                itr != children.end();
                itr++) 
            itr->decompose(out, max_subtree_size, overlap_depth);
    }
};

#endif
